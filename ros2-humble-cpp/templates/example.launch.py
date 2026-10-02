"""Template: launch ที่โหลด params.yaml และรับ argument

ใช้:  ros2 launch my_pkg example.launch.py
      ros2 launch my_pkg example.launch.py params:=/path/to/other.yaml log_level:=debug
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    default_params = os.path.join(
        get_package_share_directory("my_pkg"), "config", "params.yaml")

    params = LaunchConfiguration("params")
    log_level = LaunchConfiguration("log_level")

    return LaunchDescription([
        DeclareLaunchArgument("params", default_value=default_params,
                              description="ไฟล์ parameter"),
        DeclareLaunchArgument("log_level", default_value="info"),

        Node(
            package="my_pkg",
            executable="my_node",
            name="my_node",                 # ต้องตรงกับ key บนสุดใน params.yaml
            parameters=[params],
            arguments=["--ros-args", "--log-level", log_level],
            output="screen",
            # respawn=True, respawn_delay=2.0,   # สำหรับ driver ที่ควร restart เองเมื่อ crash
        ),
    ])
