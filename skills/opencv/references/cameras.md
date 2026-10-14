# กล้อง

ค่าของกล้อง (IP, serial, device path, exposure, gain, ความละเอียด, fps) เอามาจาก config/CLAUDE.md ของโปรเจกต์ — ไม่มีให้ถาม ไม่เดา

## อ่านภาพล่าสุด (ใช้กับกล้องทุกแบบ)
อ่านภาพใน thread แยก เก็บแค่ภาพล่าสุด + เวลา ให้ thread ที่ประมวลผลขอภาพพร้อมเช็คอายุ
thread อ่านเป็นคนเปิด/ปิด/reconnect กล้องเองคนเดียว — ไม่ release จาก thread อื่นขณะกำลัง `read()`

```python
import threading, time
import cv2

class LatestFrame:
    def __init__(self, open_fn, retry_s=1.0):
        self._open = open_fn          # function ที่คืน cv2.VideoCapture ใหม่
        self._retry_s = retry_s
        self._lock = threading.Lock()
        self._frame, self._stamp = None, 0.0
        self.connected = False
        self._stop = threading.Event()
        self._t = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self._t.start()
        return self

    def _run(self):
        cap = None
        while not self._stop.is_set():
            if cap is None:
                cap = self._open()
                if not cap.isOpened():
                    cap.release(); cap = None
                    self.connected = False
                    time.sleep(self._retry_s)
                    continue
            ok, frame = cap.read()
            if not ok:                      # กล้องหลุด → ปิดแล้วเปิดใหม่รอบหน้า
                cap.release(); cap = None
                self.connected = False
                continue
            self.connected = True
            with self._lock:
                self._frame, self._stamp = frame, time.monotonic()
        if cap is not None:
            cap.release()

    def get(self, max_age_s):
        """คืน (frame, stamp) หรือ None ถ้ายังไม่มีภาพ / ภาพเก่ากว่า max_age_s"""
        with self._lock:
            if self._frame is None or time.monotonic() - self._stamp > max_age_s:
                return None
            return self._frame, self._stamp

    def stop(self):
        self._stop.set()
        self._t.join()
```
`get()` คืน `None` → ผลเป็น `NO_IMAGE` ไม่ใช้ภาพเก่า; `max_age_s` มาจาก config (สัมพันธ์กับความเร็วสายพาน/รอบการทำงาน)

C++ ใช้โครงเดียวกัน: `std::thread` อ่าน, `std::mutex` คุม `cv::Mat latest_` + `std::chrono::steady_clock::time_point stamp_`, ตอนเก็บใช้ `frame.copyTo(latest_)` หรือ swap กับ Mat ใหม่ทุกรอบ, `get()` คืน `latest_.clone()` — ห้ามคืน Mat ที่แชร์ buffer กับ thread อ่าน

## USB / UVC
```python
cap = cv2.VideoCapture("/dev/v4l/by-id/<ชื่อกล้อง>-video-index0", cv2.CAP_V4L2)
cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))  # ตั้งก่อนความละเอียด
cap.set(cv2.CAP_PROP_FRAME_WIDTH, W)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, H)
cap.set(cv2.CAP_PROP_FPS, FPS)
```
- ใช้ path ใน `/dev/v4l/by-id/` หรือ `by-path/` ไม่ใช้ `/dev/video0` — เลขเปลี่ยนได้เมื่อเสียบใหม่หรือ reboot และกล้องหนึ่งตัวมักสร้างหลาย `/dev/video*`
- ความละเอียดสูงบน USB 2.0 ต้องใช้ MJPG — YUYV จะได้ fps ต่ำหรือเปิดไม่ได้
- `cap.set()` คืน True ไม่ได้แปลว่าตั้งได้จริง — อ่านกลับด้วย `cap.get()` แล้ว log ค่าที่ได้
- exposure / white balance / focus: ตั้งด้วย `v4l2-ctl` ตอนเริ่มโปรแกรมจะชัดกว่า `CAP_PROP_AUTO_EXPOSURE` (ค่าที่ใช้ต่างกันตาม backend)
  ```bash
  v4l2-ctl -d <device> --list-formats-ext   # format / ความละเอียด / fps ที่กล้องรองรับ
  v4l2-ctl -d <device> --list-ctrls         # ชื่อ control จริงของกล้องตัวนี้ (ต่างกันตามรุ่น/kernel)
  v4l2-ctl -d <device> --set-ctrl=<ชื่อ auto exposure>=<ค่า manual>,<ชื่อ exposure>=<ค่าจาก config>
  ```
  ตั้งแล้วอ่านกลับด้วย `--get-ctrl` — กล้องบางรุ่น reset ค่าเมื่อเปิดใหม่ จึงต้องตั้งทุกครั้งหลังเปิด

## Industrial camera (GigE Vision / USB3 Vision)
- ใช้ SDK ของยี่ห้อ (เช่น Basler pylon/pypylon, Hikrobot MVS, Teledyne FLIR Spinnaker) หรือ Aravis (open source GenICam) — ใช้ตัวที่โปรเจกต์ใช้อยู่ ไม่เปลี่ยนเอง
- แปลง buffer เป็นภาพ: Mono8 → `CV_8UC1` ตรงๆ; Bayer → `cv2.cvtColor(..., cv2.COLOR_Bayer??2BGR)` — **ชื่อ Bayer ของ OpenCV กับ GenICam ไม่ตรงกัน** ทดสอบด้วยของสีแดงกับน้ำเงินว่าสีสลับไหม แล้วจดรหัสที่ถูกไว้ใน config
- **hardware trigger** (จาก sensor/PLC) ดีกว่า free-run สำหรับชิ้นงานบนสายพาน — ได้ภาพตอนชิ้นงานอยู่ตำแหน่งเดิมทุกครั้ง; ตั้ง timeout รอภาพ ถ้า trigger แล้วไม่ได้ภาพ = NO_IMAGE
- GigE: ใช้ NIC แยกสำหรับกล้อง, IP แบบ static ตาม config, ตั้ง packet size / jumbo frame ตามที่ SDK แนะนำ — ภาพขาดเป็นแถบ/ได้ภาพไม่ครบมักมาจาก packet loss
- exposure สั้นพอให้ภาพไม่เบลอที่ความเร็วสายพานจริง — ถ้ามืดไปให้เพิ่มแสง ไม่ใช่เพิ่ม exposure

## Depth camera (เช่น Intel RealSense)
```python
import numpy as np
import pyrealsense2 as rs
pipe = rs.pipeline()
profile = pipe.start(cfg)                                   # cfg ตาม config ของโปรเจกต์
depth_scale = profile.get_device().first_depth_sensor().get_depth_scale()  # เมตรต่อหน่วย
align = rs.align(rs.stream.color)                           # ให้ pixel depth ตรงกับ pixel สี
frames = align.process(pipe.wait_for_frames(timeout_ms))
depth = np.asanyarray(frames.get_depth_frame().get_data())  # uint16
```
- **ค่า 0 = ไม่มีข้อมูล** (ไม่ใช่ระยะ 0) — เวลาอ่านระยะจากพื้นที่ ใช้ median ของ pixel ที่ไม่เป็น 0 ใน ROI เล็กๆ และนับว่ามี pixel ที่ใช้ได้พอไหม ไม่พอ = NOT_FOUND
- ระยะ = ค่า × `depth_scale` (อ่านจากกล้อง ไม่ hardcode)
- ROS2 (`realsense2_camera`): เปิด align depth แล้วใช้ topic aligned depth — ดูชื่อจริงด้วย `ros2 topic list` และหน่วยจาก `encoding` (ปกติ `16UC1` = mm)
- พื้นผิวมันวาว/ดำ/โปร่งใสให้ depth เป็นรู — ทดสอบกับชิ้นงานจริงก่อนออกแบบ

## IP camera (RTSP)
```python
import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"   # ตั้งก่อนเปิด
cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
```
- RTSP มี latency ในตัว (buffer ของ decoder) — ใช้ `LatestFrame` ข้างบนเพื่ออ่านทิ้งให้ทัน, `CAP_PROP_BUFFERSIZE` ใช้ไม่ได้กับทุก backend
- ถ้า OpenCV build มี GStreamer (ดู `getBuildInformation()`) ใช้ pipeline ที่ทิ้งภาพเก่า latency ต่ำกว่า:
  `rtspsrc location=<url> latency=0 ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! appsink drop=true max-buffers=1` (กล้อง H.264; H.265 ต้องเปลี่ยน depay/decoder)
- `rtsp_url` มี user/password — เก็บใน config ที่ไม่ขึ้น git หรือ env ไม่ใส่ในโค้ด
- เครือข่ายสะดุด `read()` อาจค้างนาน — ดู fps/อายุภาพใน log; ถ้าค้างจริงต้อง reconnect จาก thread อ่าน
