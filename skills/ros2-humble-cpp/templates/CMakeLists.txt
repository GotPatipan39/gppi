cmake_minimum_required(VERSION 3.8)
project(my_pkg)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---- dependencies (ต้องตรงกับ <depend> ใน package.xml) ----
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)

# library ภายนอกที่ไม่ใช่ ROS (ตัวอย่าง libmodbus) — เปิดเมื่อใช้
# find_package(PkgConfig REQUIRED)
# pkg_check_modules(MODBUS REQUIRED libmodbus)

include_directories(include)

# ---- node ----
add_executable(my_node src/my_node.cpp)
ament_target_dependencies(my_node rclcpp geometry_msgs)   # Humble: ใช้แบบนี้ได้ตามปกติ
# target_include_directories(my_node PRIVATE ${MODBUS_INCLUDE_DIRS})
# target_link_libraries(my_node ${MODBUS_LIBRARIES})

install(TARGETS my_node DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY include/ DESTINATION include)
install(DIRECTORY launch config DESTINATION share/${PROJECT_NAME})

# ---- tests ----
if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  # logic ล้วน (เช่น rate_limiter.hpp) ไม่ต้องลิงก์ rclcpp
  ament_add_gtest(test_example test/test_example.cpp)

  # lint: ปิดตัวที่ยังไม่พร้อมได้ แต่อย่าปิดทั้งหมดโดยไม่บอกผู้ใช้
  # find_package(ament_lint_auto REQUIRED)
  # set(ament_cmake_copyright_FOUND TRUE)
  # ament_lint_auto_find_test_dependencies()
endif()

ament_package()
