# Hardware Interface (ros2_control)

## Table of contents

1. ros2_control architecture
2. Writing a hardware interface plugin
3. Controller types and selection
4. Controller chaining and cascade control
5. Hardware modularization
6. GPIO interface
7. Serial, CAN, and EtherCAT communication patterns
8. Configuration and parameter loading
9. Real hardware bring-up workflow
10. Hardware error recovery patterns
11. Common failures and fixes

---

## 1. ros2_control architecture

```text
                  ┌──────────────────────┐
                  │   Controller Manager  │
                  │  (reads/writes at     │
                  │   fixed frequency)    │
                  └───────┬──────────────┘
                          │
              ┌───────────┼───────────────┐
              ▼           ▼               ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │ Controller A  │ │ Ctrl B   │ │ Controller C  │
     │ (JointTraj)   │ │ (Diff)   │ │ (Gripper)     │
     └──────┬───────┘ └────┬─────┘ └──────┬───────┘
            │              │              │
            ▼              ▼              ▼
     ┌─────────────────────────────────────────┐
     │           Hardware Interface             │
     │  (your plugin: reads sensors,            │
     │   writes actuator commands)              │
     └─────────────────────────────────────────┘
            │              │              │
            ▼              ▼              ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │  Motor 1  │  │  Motor 2  │  │  Gripper  │
     │ (serial)  │  │ (CAN)    │  │ (GPIO)    │
     └──────────┘  └──────────┘  └──────────┘
```

**Key concept:** The hardware interface is the bridge between ros2_control's
abstract command/state model and physical hardware communication. Controllers
never talk to hardware directly.

### Actuator vs. System vs. Sensor

When creating a `<ros2_control>` tag, you must specify the `type`:

| Type | Use Case | Characteristics |
|---|---|---|
| **System** | Multi-joint mechanisms (Robot arms, mobile bases) | Read/writes to multiple joints simultaneously. Best for buses (CAN/EtherCAT) where one frame contains all joint data. |
| **Actuator** | Single-joint mechanisms (Smart motors, simple grippers) | Read/writes to a single joint. The manager will span an instance per joint. Best for independent motors (e.g., individual PWM/Dir pins). |
| **Sensor** | Read-only hardware (IMUs, force-torque sensors) | Only exports StateInterfaces. Cannot accept commands. |

**When to use which?**

- Use **System** for 95% of real-world robots. Even if you have 6 independent serial motors, mapping them as a single System plugin often reduces thread contention and simplifies port management compared to 6 Actuator plugins fighting for USB access.
- Use **Actuator** only if each motor is truly independent (e.g., driven by separate GPIO pins) and you want maximum modularity.
- Use **Sensor** for dedicated measurement devices that don't belong to a specific actuator.

### ros2_control API: distro comparison

| Feature | Humble (2.x) | Jazzy (4.x) | Kilted (5.x) |
|---|---|---|---|
| Interface export | Manual `export_state_interfaces()` / `export_command_interfaces()` override required | **Auto-generated** from `<ros2_control>` URDF tag; override `on_export_*_interfaces()` only for extras | Auto-generated (same as Jazzy) |
| Interface memory | Manual `std::vector<double>` allocation | Framework-managed; use `set_state()` / `get_state()` / `set_command()` / `get_command()` | Framework-managed (same as Jazzy) |
| Interface data types | `double` only | `double`, `bool` + `float32`, `uint8/16/32`, `int8/16/32` | Same expanded types as Jazzy |
| Interface maps | N/A (manual vectors) | `joint_state_interfaces_`, `joint_command_interfaces_`, `sensor_state_interfaces_`, `gpio_command_interfaces_` | Same maps |
| `on_init()` signature | `on_init(const HardwareInfo & info)` | Same as Humble | **Changed**: `on_init(const HardwareComponentInterfaceParams & params)` — access `HardwareInfo` via `params.hardware_info` |
| Controller `init()` | `init()` (no args) | `init(const ControllerInterfaceParams & params)` (Humble form deprecated) | `init(const ControllerInterfaceParams & params)` (Humble form removed) |
| Lifecycle state methods | `get_state()` / `set_state()` | **Renamed**: `get_lifecycle_state()` / `set_lifecycle_state()` | Same as Jazzy |
| Handle value access | `get_value()` / `set_value()` | `get_optional()` returns `std::optional<T>`; `set_value()` returns `bool` | Same as Jazzy |
| Gripper controller | `gripper_controllers` (`position_controllers/GripperActionController`, `effort_controllers/GripperActionController`) | **Replaced**: `parallel_gripper_action_controller` | Same as Jazzy |
| Hardware-layer joint limiters | Not available | Available (Jazzy 4.28+) | **Enabled by default** |
| Async hardware scheduling | Not available | Not available | `synchronized` and `detached` policies |

**Migration path:**

- **Humble → Jazzy**: Remove `export_*_interfaces()` overrides, delete manual `std::vector<double>` members, switch to `set_state()`/`get_command()` helpers, rename `get_state()`→`get_lifecycle_state()` for lifecycle methods
- **Jazzy → Kilted**: Update `on_init()` to accept `HardwareComponentInterfaceParams`, replace `thread_priority` with `async_params`

## 2. Writing a hardware interface plugin

### System interface (Humble 2.x API)

On Humble the plugin owns the memory behind every interface: keep one
`std::vector<double>` per interface type, and hand pointers to those vectors to
the framework in `export_state_interfaces()` / `export_command_interfaces()`.
Both overrides are pure virtual in Humble's `SystemInterface`, so the class
does not compile without them. `info_` (the parsed `<ros2_control>` tag) is a
protected member set by the base `on_init()`. The Humble base class has no
`get_logger()` / `get_clock()` accessors, so the plugin creates its own logger
and clock.

```cpp
#include <cmath>
#include <limits>
#include <string>
#include <vector>

#include <hardware_interface/system_interface.hpp>
#include <hardware_interface/types/hardware_interface_type_values.hpp>
#include <rclcpp/rclcpp.hpp>

namespace my_robot_driver
{

class MyRobotHardware : public hardware_interface::SystemInterface
{
public:
  // Called once at startup — parse URDF, validate config, allocate storage
  hardware_interface::CallbackReturn on_init(
    const hardware_interface::HardwareInfo & info) override
  {
    if (hardware_interface::SystemInterface::on_init(info) !=
        hardware_interface::CallbackReturn::SUCCESS)
    {
      return hardware_interface::CallbackReturn::ERROR;
    }

    // Extract parameters from URDF <hardware><param>. No defaults in code:
    // port and baud come from the project's hardware config, never guessed.
    auto it_port = info_.hardware_parameters.find("serial_port");
    auto it_baud = info_.hardware_parameters.find("baud_rate");
    if (it_port == info_.hardware_parameters.end() ||
        it_baud == info_.hardware_parameters.end()) {
      RCLCPP_FATAL(logger_, "Missing required <param> in URDF: serial_port, baud_rate");
      return hardware_interface::CallbackReturn::ERROR;
    }
    port_ = it_port->second;
    try {
      baud_ = std::stoi(it_baud->second);
    } catch (const std::exception & e) {
      RCLCPP_FATAL(logger_, "Invalid baud_rate '%s': %s",
                   it_baud->second.c_str(), e.what());
      return hardware_interface::CallbackReturn::ERROR;
    }

    // Validate joint configuration from URDF
    for (const auto & joint : info_.joints) {
      if (joint.command_interfaces.size() != 1 ||
          joint.command_interfaces[0].name != hardware_interface::HW_IF_POSITION) {
        RCLCPP_FATAL(logger_, "Joint '%s' needs exactly 1 position command interface",
                     joint.name.c_str());
        return hardware_interface::CallbackReturn::ERROR;
      }
    }

    // Humble: the plugin owns interface memory. NaN marks "not read yet".
    const double nan = std::numeric_limits<double>::quiet_NaN();
    hw_positions_.assign(info_.joints.size(), nan);
    hw_velocities_.assign(info_.joints.size(), nan);
    hw_commands_.assign(info_.joints.size(), nan);

    return hardware_interface::CallbackReturn::SUCCESS;
  }

  // Required on Humble: expose pointers into the plugin's own storage.
  // The names must match the <state_interface>/<command_interface> tags.
  std::vector<hardware_interface::StateInterface> export_state_interfaces() override
  {
    std::vector<hardware_interface::StateInterface> interfaces;
    for (size_t i = 0; i < info_.joints.size(); i++) {
      interfaces.emplace_back(
        info_.joints[i].name, hardware_interface::HW_IF_POSITION, &hw_positions_[i]);
      interfaces.emplace_back(
        info_.joints[i].name, hardware_interface::HW_IF_VELOCITY, &hw_velocities_[i]);
    }
    return interfaces;
  }

  std::vector<hardware_interface::CommandInterface> export_command_interfaces() override
  {
    std::vector<hardware_interface::CommandInterface> interfaces;
    for (size_t i = 0; i < info_.joints.size(); i++) {
      interfaces.emplace_back(
        info_.joints[i].name, hardware_interface::HW_IF_POSITION, &hw_commands_[i]);
    }
    return interfaces;
  }

  // Open hardware connection
  hardware_interface::CallbackReturn on_activate(
    const rclcpp_lifecycle::State &) override
  {
    serial_ = open_serial(port_, baud_);
    if (!serial_.is_open()) {
      return hardware_interface::CallbackReturn::ERROR;
    }

    // Read once, then initialize commands to current positions to prevent
    // a jump on activation.
    if (read(rclcpp::Time(0), rclcpp::Duration(0, 0)) != hardware_interface::return_type::OK) {
      return hardware_interface::CallbackReturn::ERROR;
    }
    for (size_t i = 0; i < hw_commands_.size(); i++) {
      hw_commands_[i] = hw_positions_[i];
    }

    return hardware_interface::CallbackReturn::SUCCESS;
  }

  // Close hardware connection
  hardware_interface::CallbackReturn on_deactivate(
    const rclcpp_lifecycle::State &) override
  {
    serial_.close();
    return hardware_interface::CallbackReturn::SUCCESS;
  }

  // Called at controller_manager frequency — READ from hardware
  hardware_interface::return_type read(
    const rclcpp::Time &, const rclcpp::Duration &) override
  {
    // Read encoder data from serial/CAN/EtherCAT
    auto data = read_encoders(serial_);
    if (!data.valid) {
      RCLCPP_ERROR_THROTTLE(logger_, clock_, 1000, "Failed to read encoder data");
      return hardware_interface::return_type::ERROR;
    }

    // Index i matches info_.joints[i], the same order used in export_*().
    for (size_t i = 0; i < info_.joints.size(); i++) {
      hw_positions_[i] = data.positions[i];
      hw_velocities_[i] = data.velocities[i];
    }
    return hardware_interface::return_type::OK;
  }

  // Called at controller_manager frequency — WRITE to hardware
  hardware_interface::return_type write(
    const rclcpp::Time &, const rclcpp::Duration &) override
  {
    // Controllers wrote into hw_commands_ through the exported CommandInterfaces
    // NaN = no command (startup, or a controller deactivating). Skipping the write is
    // only safe because this example is a POSITION interface: the drive holds where it is.
    // VELOCITY / EFFORT interfaces: skipping keeps the last setpoint = the machine keeps
    // moving — there, send an explicit stop (0 / disable) instead and log it.
    for (const double cmd : hw_commands_) {
      if (std::isnan(cmd)) {
        return hardware_interface::return_type::OK;  // position: hold
      }
    }
    if (!send_commands(serial_, hw_commands_)) {
      RCLCPP_ERROR_THROTTLE(logger_, clock_, 1000, "Failed to send commands to hardware");
      return hardware_interface::return_type::ERROR;
    }
    return hardware_interface::return_type::OK;
  }

private:
  rclcpp::Logger logger_ = rclcpp::get_logger("MyRobotHardware");
  rclcpp::Clock clock_{RCL_STEADY_TIME};

  std::vector<double> hw_positions_;
  std::vector<double> hw_velocities_;
  std::vector<double> hw_commands_;

  std::string port_;
  int baud_{0};
  SerialPort serial_;  // placeholder for your transport class
};

}  // namespace my_robot_driver

#include <pluginlib/class_list_macros.hpp>
PLUGINLIB_EXPORT_CLASS(my_robot_driver::MyRobotHardware,
                       hardware_interface::SystemInterface)
```

The pattern matches the Humble `ros2_control_demos` hardware examples
(`hw_positions_` / `hw_commands_` vectors, `export_*_interfaces()` overrides,
`rclcpp::get_logger(...)`).

> **Jazzy differs (not for Humble code):** Jazzy (4.x) auto-exports interfaces
> from the `<ros2_control>` tag, so the `export_*_interfaces()` overrides and
> the storage vectors go away; values are accessed through
> `set_state(name, value)` / `get_command(name)` and the
> `joint_state_interfaces_` / `joint_command_interfaces_` maps, the base class
> provides `get_logger()` / `get_clock()`, and the lifecycle accessor is renamed
> `get_lifecycle_state()`. None of that exists on Humble; code written that way
> does not build here. Kilted (5.x) additionally changes `on_init()` to take
> `HardwareComponentInterfaceParams`. See the comparison table above.

### Plugin registration (CMakeLists.txt addition)

```cmake
pluginlib_export_plugin_description_file(
  hardware_interface my_robot_hardware_plugin.xml)
```

### Plugin descriptor (my_robot_hardware_plugin.xml)

```xml
<library path="my_robot_driver">
  <class name="my_robot_driver/MyRobotHardware"
         type="my_robot_driver::MyRobotHardware"
         base_class_type="hardware_interface::SystemInterface">
    <description>Hardware interface for My Robot</description>
  </class>
</library>
```

> **Jazzy differs — not available on Humble:** on Humble, enforce limits in the controllers and in the drive/firmware; the hardware-layer limiter described next does not exist in ros2_control 2.x.

**Hardware-layer joint limiters (Jazzy 4.28+ / Kilted 5.x only):** ros2_control supports joint limits enforced directly at the hardware interface layer via `<limits>` tags in the URDF. These act as a safety net below the controller -- even if a controller sends an out-of-range command, the hardware interface clips it. In Kilted, joint limit enforcement is fully built into the framework and enabled by default; no additional controller-side configuration is needed. Configure in URDF:

```xml
<joint name="joint_1">
  <command_interface name="position">
    <param name="min">-3.14</param>
    <param name="max">3.14</param>
  </command_interface>
  <!-- Hardware-layer limits (enforced by framework, not controller) -->
  <limit effort="100.0" velocity="2.0" lower="-3.14" upper="3.14"/>
</joint>
```

## 3. Controller types and selection

| Controller | Command interface | Use case |
|---|---|---|
| `joint_trajectory_controller` | position/velocity | Smooth multi-joint trajectories |
| `forward_command_controller` | position/velocity/effort | Direct pass-through, simple control |
| `diff_drive_controller` | velocity | Differential drive mobile base |
| `joint_state_broadcaster` | (none — reads only) | Publish joint states for TF/visualization |
| `gripper_controllers` | position or effort | Gripper with `control_msgs/GripperCommand` action; Humble plugin types `position_controllers/GripperActionController` / `effort_controllers/GripperActionController` |
| `pid_controller` | effort | Low-level PID for torque control |
| `admittance_controller` | position | Force-compliant manipulation |
| `mecanum_drive_controller` | velocity | Mecanum-wheel omnidirectional base |
| `ackermann_steering_controller` | position/velocity | Ackermann-steered vehicles (`steering_controllers_library`) |
| `bicycle_steering_controller` | position/velocity | Bicycle-model steered robots (`steering_controllers_library`) |
| `tricycle_steering_controller` | position/velocity | Tricycle-steered mobile bases (`steering_controllers_library`) |
| `tricycle_controller` | position/velocity | Tricycle base (separate, older package) |
| `gpio_controllers` | GPIO command interfaces | Expose GPIO command interfaces as a topic |

All controllers in this table are in the Humble `ros2_controllers` branch and
the Humble controller index (control.ros.org/humble). Check that the binary
package (`ros-humble-<name>`) is installed on the target before relying on it.

### diff_drive_controller on Humble: stamped vs unstamped cmd_vel

On Humble, `use_stamped_vel` defaults to `true`. The controller then listens on
`~/cmd_vel` for `geometry_msgs/msg/TwistStamped` only. A plain
`geometry_msgs/msg/Twist` (what `teleop_twist_keyboard` and Nav2 on Humble
publish) must go to `~/cmd_vel_unstamped`, which is used when
`use_stamped_vel: false`. A `Twist` published on `~/cmd_vel` with the default
never reaches the controller (type mismatch), so the base silently does not
move. Either set `use_stamped_vel: false` and
remap the Twist source to `<controller_name>/cmd_vel_unstamped`, or publish
`TwistStamped`. (Jazzy removes the unstamped path: `~/cmd_vel` must be
stamped.)

### Controller configuration (YAML)

```yaml
controller_manager:
  ros__parameters:
    update_rate: 500  # Hz — must match or exceed your control loop needs

    joint_state_broadcaster:
      type: joint_state_broadcaster/JointStateBroadcaster

    arm_controller:
      type: joint_trajectory_controller/JointTrajectoryController

arm_controller:
  ros__parameters:
    joints:
      - joint_1
      - joint_2
      - joint_3
      - joint_4
      - joint_5
      - joint_6
    command_interfaces:
      - position
    state_interfaces:
      - position
      - velocity
    state_publish_rate: 100.0
    action_monitor_rate: 20.0
    allow_partial_joints_goal: false
    constraints:
      stopped_velocity_tolerance: 0.01
      goal_time: 0.0
```

#### Jazzy differs: gripper controller migration (not for Humble)

On Humble use `gripper_controllers` (table above); `parallel_gripper_action_controller`
is not in the Humble `ros2_controllers` branch. When a project moves to Jazzy,
the old `GripperActionController` types are deprecated there in favour of
`parallel_gripper_action_controller`:

- Action interface changes from `control_msgs/GripperCommand` to the same interface but with updated parameter naming
- YAML change: `type: position_controllers/GripperActionController` (or `effort_controllers/...`) -> `type: parallel_gripper_action_controller/GripperActionController`
- The `parallel_gripper` supports both position and effort control modes

## 4. Controller chaining and cascade control

Controller chaining is available on Humble (serial chaining, documented under
control.ros.org/humble → controller_manager → "Controller Chaining"). It allows
controllers to feed their output into other controllers, enabling cascade
control architectures. A `ChainableControllerInterface` exports **reference
interfaces** that other controllers can write to. On Humble,
`diff_drive_controller` is **not** chainable (it only subscribes to `~/cmd_vel` /
`~/cmd_vel_unstamped`; chained mode arrived in later distros), while the
steering controllers (`steering_controllers_library`) and
`mecanum_drive_controller` expose reference interfaces — check the installed
controller's docs before designing a chain around it.

Example (Humble 2.x API): a velocity PID controller that accepts reference
commands from a joint_trajectory_controller. `on_init()`,
`on_configure()` (parameter loading, `reference_interfaces_.resize(n, NaN)`) and
`on_activate()` are omitted for brevity — but the reference **must start as NaN**
(= "no reference"), and `update_and_write_commands` below must turn NaN into a
safe command. Never initialise references with an old value or leave them
uninitialised: a velocity loop would drive toward whatever is there.

```cpp
#include <algorithm>
#include <cmath>
#include <limits>

#include <controller_interface/chainable_controller_interface.hpp>
#include <control_toolbox/pid.hpp>
#include <hardware_interface/types/hardware_interface_type_values.hpp>

class VelocityPidController : public controller_interface::ChainableControllerInterface
{
public:
  // Reference interfaces: what upstream controllers write TO this controller.
  // Humble: values must live in the base-class member reference_interfaces_
  // (std::vector<double>), and the prefix must be this controller's name.
  // Full name here: "<controller_name>/<joint>/velocity".
  std::vector<hardware_interface::CommandInterface> on_export_reference_interfaces() override
  {
    std::vector<hardware_interface::CommandInterface> refs;
    for (size_t i = 0; i < joint_names_.size(); ++i) {
      refs.emplace_back(get_node()->get_name(),
                        joint_names_[i] + "/" + hardware_interface::HW_IF_VELOCITY,
                        &reference_interfaces_[i]);
    }
    return refs;
  }

  // Required (pure virtual): when NOT chained, take references from a
  // subscriber instead. Here: no subscriber — so there is no source of fresh
  // references; clear them to NaN (= stop) rather than keeping the last one,
  // otherwise an old velocity setpoint stays in force indefinitely.
  // If you add a subscriber, also add a timeout that sets NaN when it goes stale.
  controller_interface::return_type update_reference_from_subscribers() override
  {
    std::fill(reference_interfaces_.begin(), reference_interfaces_.end(),
              std::numeric_limits<double>::quiet_NaN());
    return controller_interface::return_type::OK;
  }

  // State interfaces: what this controller reads (e.g., current velocity)
  controller_interface::InterfaceConfiguration state_interface_configuration() const override
  {
    controller_interface::InterfaceConfiguration config;
    config.type = controller_interface::interface_configuration_type::INDIVIDUAL;
    for (const auto & joint : joint_names_) {
      config.names.push_back(joint + "/velocity");
    }
    return config;
  }

  // Command interfaces: what this controller writes (e.g., effort to hardware)
  controller_interface::InterfaceConfiguration command_interface_configuration() const override
  {
    controller_interface::InterfaceConfiguration config;
    config.type = controller_interface::interface_configuration_type::INDIVIDUAL;
    for (const auto & joint : joint_names_) {
      config.names.push_back(joint + "/effort");
    }
    return config;
  }

  controller_interface::return_type update_and_write_commands(
    const rclcpp::Time & /*time*/, const rclcpp::Duration & period) override
  {
    for (size_t i = 0; i < joint_names_.size(); ++i) {
      const double ref = reference_interfaces_[i];
      if (!std::isfinite(ref)) {              // no reference yet / upstream stopped
        pid_controllers_[i].reset();          // no integral wind-up carried into the next start
        command_interfaces_[i].set_value(0.0);  // zero effort — check this is "safe" for YOUR axis (gravity!)
        continue;
      }
      const double vel = state_interfaces_[i].get_value();    // Humble handle API
      // Humble control_toolbox::Pid::computeCommand takes dt in nanoseconds (uint64_t)
      const double effort = pid_controllers_[i].computeCommand(ref - vel, period.nanoseconds());
      command_interfaces_[i].set_value(effort);
    }
    return controller_interface::return_type::OK;
  }

private:
  std::vector<std::string> joint_names_;
  std::vector<control_toolbox::Pid> pid_controllers_;
};
```

> **Jazzy differs:** handle access becomes `get_optional()` / `set_value()`
> returning `bool`, and controller `init()` takes `ControllerInterfaceParams`.
> Keep the Humble form above for Humble code.

YAML configuration for chaining:

```yaml
controller_manager:
  ros__parameters:
    update_rate: 1000

    velocity_pid:
      type: my_controllers/VelocityPidController

    trajectory_controller:
      type: joint_trajectory_controller/JointTrajectoryController

trajectory_controller:
  ros__parameters:
    joints: [joint_1, joint_2]              # state interfaces are read from these
    command_joints: [velocity_pid/joint_1,  # commands go to velocity_pid's references
                     velocity_pid/joint_2]
    command_interfaces: [velocity]          # JTC allows only position/velocity/acceleration/effort
    state_interfaces: [position, velocity]
```

`command_joints` is the Humble JTC parameter for chaining, used when the
command interfaces have different prefixes from the state interfaces.

Activation order matters: activate the downstream controller (velocity_pid) before the upstream (trajectory_controller), or both together with the spawner's `--activate-as-group`. Activating controllers moves a real robot: Claude shows these steps but asks the user before running a spawner or `ros2 control set_controller_state` against real hardware.

## 5. Hardware modularization

Split a robot into multiple independent `<ros2_control>` tags when subsystems have different update rates, failure modes, or lifecycle requirements.

```xml
<!-- Separate hardware interfaces for arm and mobile base -->
<ros2_control name="ArmSystem" type="system">
  <hardware>
    <plugin>my_robot_driver/ArmHardware</plugin>
    <param name="can_interface">${arm_can_interface}</param>  <!-- from project config -->
  </hardware>
  <joint name="shoulder">...</joint>
  <joint name="elbow">...</joint>
</ros2_control>

<ros2_control name="BaseSystem" type="system">
  <hardware>
    <plugin>my_robot_driver/BaseHardware</plugin>
    <param name="serial_port">${base_serial_port}</param>  <!-- from project config -->
  </hardware>
  <joint name="left_wheel">...</joint>
  <joint name="right_wheel">...</joint>
</ros2_control>

<ros2_control name="GripperSystem" type="actuator">
  <hardware>
    <plugin>my_robot_driver/GripperHardware</plugin>
  </hardware>
  <joint name="gripper_finger">
    <command_interface name="position"/>
    <state_interface name="position"/>
  </joint>
</ros2_control>
```

Benefits: Each subsystem can be activated/deactivated independently. If the gripper loses communication, the arm and base continue operating. Controller manager calls read()/write() for each hardware interface separately.

## 6. GPIO interface

```cpp
// GPIO hardware interface for digital I/O (e-stop, LEDs, limit switches)
hardware_interface::CallbackReturn on_init(
  const hardware_interface::HardwareInfo & info) override
{
  // GPIO interfaces are defined in URDF under <gpio> tags
  for (const auto & gpio : info_.gpios) {
    RCLCPP_INFO(logger_, "GPIO: %s, cmd_ifs=%zu, state_ifs=%zu",
                gpio.name.c_str(),
                gpio.command_interfaces.size(),
                gpio.state_interfaces.size());
  }
  return hardware_interface::CallbackReturn::SUCCESS;
}
```

URDF GPIO definition:

```xml
<ros2_control name="GPIOSystem" type="system">
  <hardware>
    <plugin>my_robot_driver/GPIOHardware</plugin>
  </hardware>
  <gpio name="digital_io">
    <command_interface name="led_red"/>
    <command_interface name="led_green"/>
    <state_interface name="estop_active"/>
    <state_interface name="limit_switch_1"/>
  </gpio>
</ros2_control>
```

Export and access on Humble (interfaces are `double`; the plugin owns the
storage, as in section 2). Pin numbers are placeholders taken from the
project's wiring/config, never guessed:

```cpp
// Members: one slot per <gpio> interface, in URDF order
std::vector<double> gpio_states_;    // estop_active, limit_switch_1
std::vector<double> gpio_commands_;  // led_red, led_green

// In export_state_interfaces() / export_command_interfaces(), append:
const auto & gpio = info_.gpios[0];  // "digital_io"
for (size_t i = 0; i < gpio.state_interfaces.size(); ++i) {
  interfaces.emplace_back(gpio.name, gpio.state_interfaces[i].name, &gpio_states_[i]);
}
// (same loop over gpio.command_interfaces with &gpio_commands_[i])

// In read():
gpio_states_[0] = read_gpio_pin(ESTOP_PIN) ? 1.0 : 0.0;   // digital_io/estop_active
gpio_states_[1] = read_gpio_pin(LIMIT_PIN) ? 1.0 : 0.0;   // digital_io/limit_switch_1

// In write():
set_gpio_pin(LED_RED_PIN, gpio_commands_[0] > 0.5);       // digital_io/led_red
set_gpio_pin(LED_GREEN_PIN, gpio_commands_[1] > 0.5);     // digital_io/led_green
```

> **Jazzy differs:** the auto-exported form `set_state("digital_io/estop_active", ...)`
> / `get_command("digital_io/led_red")` and `bool` interface types are Jazzy+
> only.

Use `gpio_command_controller` (from ros2_controllers) to expose GPIO as a ROS service/topic.

### URDF integration

```xml
<robot xmlns:xacro="http://www.ros.org/wiki/xacro" name="my_robot">

  <ros2_control name="MyRobotSystem" type="system">
    <hardware>
      <plugin>my_robot_driver/MyRobotHardware</plugin>
      <!-- Placeholders: take port, baud and joint limits from the project's
           hardware config / datasheet. Never guess them. -->
      <param name="serial_port">${serial_port}</param>
      <param name="baud_rate">${baud_rate}</param>
    </hardware>

    <joint name="joint_1">
      <command_interface name="position">
        <param name="min">-3.14</param>  <!-- example value -->
        <param name="max">3.14</param>   <!-- example value -->
      </command_interface>
      <state_interface name="position"/>
      <state_interface name="velocity"/>
    </joint>

    <joint name="joint_2">
      <command_interface name="position">
        <param name="min">-1.57</param>
        <param name="max">1.57</param>
      </command_interface>
      <state_interface name="position"/>
      <state_interface name="velocity"/>
    </joint>
  </ros2_control>

</robot>
```

## 7. Serial, CAN, and EtherCAT communication patterns

### Serial protocol best practices

```cpp
class SerialTransport
{
public:
  // Non-blocking read with timeout
  std::optional<Frame> read_frame(std::chrono::milliseconds timeout)
  {
    auto start = std::chrono::steady_clock::now();
    while (std::chrono::steady_clock::now() - start < timeout) {
      if (auto byte = serial_.read_byte()) {
        parser_.feed(*byte);
        if (parser_.has_frame()) {
          return parser_.extract_frame();
        }
      } else {
        std::this_thread::sleep_for(std::chrono::microseconds(100));  // Avoid busy-wait
      }
    }
    return std::nullopt;  // Timeout — caller decides how to handle
  }

  // Batched write — send all joint commands in one frame
  bool write_commands(const std::vector<double> & commands)
  {
    auto frame = protocol_.encode_position_commands(commands);
    return serial_.write(frame.data(), frame.size()) == frame.size();
  }

private:
  Serial serial_;
  FrameParser parser_;
  Protocol protocol_;
};
```

**Timing discipline:**

- The ros2_control `read()` and `write()` are called by the controller manager
  at a fixed rate. Your serial communication must complete within one cycle.
- If serial read takes longer than the cycle period, you get jitter. Solutions:
  - Use a separate thread for serial I/O with a shared buffer
  - Increase baud rate
  - Reduce message size
  - Lower the controller manager update rate

### CAN bus pattern (SocketCAN)

```cpp
#include <linux/can.h>
#include <linux/can/raw.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <fcntl.h>
#include <unistd.h>
#include <cstring>

class CanBus
{
public:
  ~CanBus() { if (sock_ >= 0) { close(sock_); sock_ = -1; } }

  bool init(const std::string & interface)
  {
    sock_ = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (sock_ < 0) { return false; }
    // Set non-blocking
    if (fcntl(sock_, F_SETFL, O_NONBLOCK) < 0) { close(sock_); sock_ = -1; return false; }
    // Bind to interface
    struct ifreq ifr{};
    std::strncpy(ifr.ifr_name, interface.c_str(), IFNAMSIZ - 1);
    if (ioctl(sock_, SIOCGIFINDEX, &ifr) < 0) { close(sock_); sock_ = -1; return false; }
    struct sockaddr_can addr{};
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (bind(sock_, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
      close(sock_); sock_ = -1; return false;
    }
    return true;
  }

  bool send(uint32_t id, const uint8_t * data, uint8_t len)
  {
    if (len > CAN_MAX_DLEN) { return false; }  // Prevent buffer overflow
    struct can_frame frame{};
    frame.can_id = id;
    frame.can_dlc = len;
    std::memcpy(frame.data, data, len);
    return ::write(sock_, &frame, sizeof(frame)) == sizeof(frame);
  }

  std::optional<can_frame> receive()
  {
    struct can_frame frame{};
    auto n = ::read(sock_, &frame, sizeof(frame));
    if (n < 0) { return std::nullopt; }         // Error (EAGAIN for non-blocking = no data)
    if (n != sizeof(frame)) { return std::nullopt; }  // Partial read
    return frame;
  }
};
```

### EtherCAT pattern (SOEM)

```cpp
#include <soem/ethercat.h>

class EtherCATBus
{
public:
  bool init(const std::string & ifname, int expected_slaves)
  {
    if (ec_init(ifname.c_str()) <= 0) { return false; }
    if (ec_config_init(FALSE) < expected_slaves) {
      ec_close();
      return false;
    }
    // Map PDO (Process Data Objects)
    ec_config_map(&io_map_);
    // Set all slaves to SAFE_OP, then OP
    ec_statecheck(0, EC_STATE_SAFE_OP, EC_TIMEOUTSTATE);
    ec_slave[0].state = EC_STATE_OPERATIONAL;
    ec_writestate(0);
    ec_statecheck(0, EC_STATE_OPERATIONAL, EC_TIMEOUTSTATE);
    return ec_slave[0].state == EC_STATE_OPERATIONAL;
  }

  void process_cycle()
  {
    ec_send_processdata();
    ec_receive_processdata(EC_TIMEOUTRET);  // Deterministic timing critical
  }

  // Access PDO data via mapped memory (io_map_)
  template<typename T>
  T read_input(int slave, int offset) {
    return *reinterpret_cast<T*>(ec_slave[slave].inputs + offset);
  }

  template<typename T>
  void write_output(int slave, int offset, T value) {
    *reinterpret_cast<T*>(ec_slave[slave].outputs + offset) = value;
  }

  void close() { ec_close(); }

private:
  char io_map_[4096];
};
```

Integration with ros2_control: call `process_cycle()` in `read()`, then extract encoder values from PDO inputs. In `write()`, write command values to PDO outputs, then `process_cycle()` sends them. EtherCAT requires deterministic timing -- pair with PREEMPT_RT and CPU isolation (real-time kernel setup is outside this skill; follow the ros2_control and kernel documentation for the target machine).

## 8. Configuration and parameter loading

### Launch file for ros2_control

```python
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.substitutions import Command, PathJoinSubstitution
from launch_ros.substitutions import FindPackageShare

def generate_launch_description():
    robot_description = Command([
        'xacro ',
        PathJoinSubstitution([
            FindPackageShare('my_robot_description'),
            'urdf', 'robot.urdf.xacro'
        ])
    ])

    controller_params = PathJoinSubstitution([
        FindPackageShare('my_robot_control'),
        'config', 'controllers.yaml'
    ])

    return LaunchDescription([
        # robot_state_publisher publishes the URDF on /robot_description
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            parameters=[{'robot_description': robot_description}],
        ),
        # Humble: passing robot_description as a controller_manager parameter
        # is deprecated; the manager subscribes to ~/robot_description, so
        # remap it to the topic robot_state_publisher publishes.
        Node(
            package='controller_manager',
            executable='ros2_control_node',
            parameters=[controller_params],
            remappings=[('~/robot_description', '/robot_description')],
            output='screen',
        ),
        Node(
            package='controller_manager',
            executable='spawner',
            arguments=['joint_state_broadcaster',
                       '--controller-manager', '/controller_manager'],
        ),
        Node(
            package='controller_manager',
            executable='spawner',
            arguments=['arm_controller',
                       '--controller-manager', '/controller_manager',
                       '--param-file', controller_params],
        ),
    ])
```

With a real hardware plugin in the URDF, this launch opens the hardware and the
spawners activate controllers: Claude asks the user before running it.

## 9. Real hardware bring-up workflow

1. **Start with mock hardware** — ros2_control has a built-in mock system:

   ```xml
   <plugin>mock_components/GenericSystem</plugin>
   <param name="mock_sensor_commands">true</param>
   ```

   Verify controllers and TF work before touching real hardware.

2. **Implement `on_init` and `export_*_interfaces`** — validate URDF parsing
   and joint configuration, allocate the storage vectors, and export them
   (required on Humble; see section 2).

3. **Implement `on_activate`** — open the hardware connection. Test that
   the connection succeeds and fails gracefully.

4. **Implement `read()`** — start reading real sensor data. Verify values
   in RViz with `joint_state_broadcaster`.

5. **Implement `write()`** — send commands. Start with very slow, small
   movements. Have an emergency stop within reach.

6. **Tune update rate** — start low (100 Hz), increase until you hit
   serial/CAN bandwidth limits or jitter thresholds.

## 10. Hardware error recovery patterns

### Transient vs fatal errors

Not all hardware errors are equal. Distinguish between transient (retry-safe) and
fatal (requires operator intervention) errors in `read()` and `write()`
(`logger_` / `clock_` are the members from the section 2 example; Humble's base
class has no `get_logger()` / `get_clock()`):

```cpp
hardware_interface::return_type MyHardware::read(
  const rclcpp::Time &, const rclcpp::Duration &)
{
  auto data = read_encoders(serial_);
  if (!data.valid) {
    consecutive_read_failures_++;

    if (consecutive_read_failures_ <= MAX_TRANSIENT_FAILURES) {
      // Transient: use last known values (stale data is safer than no data)
      RCLCPP_WARN_THROTTLE(logger_, clock_, 1000,
        "Read failed (%d/%d) — using last known values",
        consecutive_read_failures_, MAX_TRANSIENT_FAILURES);
      return hardware_interface::return_type::OK;  // Don't crash the loop
    }

    // Fatal: too many consecutive failures — hardware is unreachable
    RCLCPP_ERROR(logger_,
      "Hardware unreachable after %d consecutive failures — requesting error transition",
      consecutive_read_failures_);
    return hardware_interface::return_type::ERROR;  // Triggers on_error()
  }

  consecutive_read_failures_ = 0;  // Reset on success
  // ... update state interfaces ...
  return hardware_interface::return_type::OK;
}
```

### on_error() recovery strategy

```cpp
hardware_interface::CallbackReturn on_error(
  const rclcpp_lifecycle::State & previous_state) override
{
  RCLCPP_ERROR(logger_, "Hardware error from state: %s", previous_state.label().c_str());

  // 1. Safe the hardware — send zero velocity / disable torque
  send_safe_command(serial_);

  // 2. Close and reopen the connection
  serial_.close();
  std::this_thread::sleep_for(std::chrono::milliseconds(500));

  if (serial_.reopen(port_, baud_)) {
    RCLCPP_INFO(logger_, "Hardware reconnected — transitioning to Unconfigured");
    consecutive_read_failures_ = 0;
    return hardware_interface::CallbackReturn::SUCCESS;  // → Unconfigured (can reconfigure)
  }

  RCLCPP_FATAL(logger_, "Hardware reconnection failed — manual intervention required");
  return hardware_interface::CallbackReturn::ERROR;  // → Finalized (dead)
}
```

### Resource leak prevention

Hardware interfaces must cleanly release resources even on abnormal shutdown:

```cpp
hardware_interface::CallbackReturn on_deactivate(
  const rclcpp_lifecycle::State &) override
{
  // ALWAYS send safe commands before closing — prevents motors
  // from holding last command when the controller stops.
  send_zero_velocity(serial_);
  serial_.close();
  return hardware_interface::CallbackReturn::SUCCESS;
}

// Destructor: best-effort cleanup for normal teardown and SOME abnormal
// unwind paths. It is NOT a crash safety net — see below.
~MyRobotHardware() override
{
  if (serial_.is_open()) {
    try { send_zero_velocity(serial_); } catch (...) {}
    serial_.close();
  }
}
```

**What the destructor does and does not cover.** Sending a safe command in
both `on_deactivate` and the destructor is good shutdown hygiene — it covers
normal teardown and some exceptional unwind paths. It is **not** a crash
safety net:

- **SIGKILL and power loss:** the destructor does not run.
- **Segmentation faults and other abnormal terminations:** destructor
  execution is not guaranteed.
- Communication loss between the process and the hardware makes any
  process-side command moot.

Actual crash safety must live **downstream of the process**: a command
timeout in the motor controller or vendor firmware (no fresh command → stop),
a heartbeat/watchdog that gates motion (see `references/safety-estop.md` —
no heartbeat, no motion), a hardware failsafe/STO input, and a hardware
e-stop chain. Treat the process-side cleanup as hygiene, and verify the
downstream failsafe with a deliberate kill test: `kill -9` the control
process and confirm the actuators stop. **This test moves a real robot if
the failsafe is broken** — it is a commissioning test performed by an
operator, never an automated step for CI or an AI agent to run on hardware.
Validate the behavior in simulation/HIL first; on the real robot, put the
platform on a stand or in a cage (wheels/legs off the ground), apply speed
and torque limits, and keep the physical e-stop in hand.

## 11. Common failures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Controller manager fails to load HW interface | Plugin not registered or not installed | Check `pluginlib_export_plugin_description_file`, rebuild, `source install/setup.bash` |
| `command_interface not found` | URDF joint name doesn't match controller config | Exact string match required — check for typos and namespaces |
| Controller reports "hardware not activated" | Lifecycle not transitioned | Use `ros2 control set_controller_state` or spawner (on real hardware Claude asks the user first — activation can move the robot) |
| Jitter in control loop | `read()` or `write()` takes too long | Profile with `ros2 control list_hardware_interfaces`, offload I/O to thread |
| Robot jumps on activation | Initial command is 0.0, not current position | In `on_activate`, read once and sync commands to state: `hw_commands_[i] = hw_positions_[i]` (Humble; Jazzy uses `set_command(name, get_state(name))`) |
| Emergency stop doesn't work | `write()` still sends last command | Check for `is_active()` in write, send zero-velocity on deactivate; the stop path itself must be a downstream watchdog/hardware chain, not node code (`references/safety-estop.md`) |
| Permission denied on serial port | User not in dialout group | `sudo usermod -aG dialout $USER`, re-login |
| Controller chain activation fails | Downstream controller not activated before upstream | Activate in dependency order: hardware -> downstream controller -> upstream controller |
| EtherCAT slave not reaching OP state | Incorrect PDO mapping or timing violation | Check ESI file, verify PDO sizes match slave documentation, ensure RT kernel |
| GPIO values not updating | GPIO interfaces not exported, or exported under a name that differs from the URDF | Export every `<gpio>` interface in `export_*_interfaces()` with the exact URDF names: prefix = gpio name, interface = URDF interface name (e.g., "digital_io/estop_active") |
| Base does not move, no error, `diff_drive_controller` active | Plain `Twist` sent to `~/cmd_vel` while `use_stamped_vel` is `true` (Humble default) | Send `Twist` to `~/cmd_vel_unstamped` with `use_stamped_vel: false`, or publish `TwistStamped` (section 3) |
