# ส่วนที่มาจากภายนอก

บางส่วนของ gppi ดัดแปลง/แปลมาจาก repo อื่น การแปลเป็นภาษาไทยและเรียบเรียงใหม่ยังนับเป็นงานที่ดัดแปลงจากต้นฉบับ จึงแนบ notice ของต้นฉบับไว้ที่นี่ แม้ส่วนที่ดัดแปลงบางชิ้นจะเหลือจากต้นฉบับไม่มาก
รายละเอียดว่าเอาอะไรมาและไม่เอาอะไร อยู่ใน `CHANGELOG.md` ของ skill นั้น

| ส่วนใน gppi | ต้นฉบับ | license | notice |
|---|---|---|---|
| `skills/grilling/`, `skills/domain-modeling/` | [mattpocock/skills](https://github.com/mattpocock/skills) (copy ทั้งไฟล์ ไม่แก้) | MIT | `LICENSE` ในโฟลเดอร์ของแต่ละตัว |
| `skills/tdd/` | mattpocock/skills `tdd` @ 3f59913 (ดัดแปลง) | MIT | [ข้างล่าง](#mit--matt-pocock) |
| `skills/git-commit/` | [github/awesome-copilot](https://github.com/github/awesome-copilot) `git-commit` @ 143a3d9 (ดัดแปลง) | MIT | [ข้างล่าง](#mit--github-inc) |
| `skills/project-readme/` (แนวคิดบางส่วน) | github/awesome-copilot `create-readme` | MIT | [ข้างล่าง](#mit--github-inc) |
| `skills/ros2-humble-cpp/references/` | [dbwls99706/ros2-engineering-skills](https://github.com/dbwls99706/ros2-engineering-skills) | Apache-2.0 | [`references/LICENSE`](skills/ros2-humble-cpp/references/LICENSE) |
| `skills/industrial-ui/platforms/ros2-bridge.md` | [arpitg1304/robotics-agent-skills](https://github.com/arpitg1304/robotics-agent-skills) `ros2-web-integration` | Apache-2.0 | ข้อความ license เดียวกับ [`ros2-humble-cpp/references/LICENSE`](skills/ros2-humble-cpp/references/LICENSE) |
| `skills/industrial-ui/` (แนวคิดบางส่วน) | [anthropics/skills](https://github.com/anthropics/skills) `frontend-design` | Apache-2.0 | เหมือนข้างบน |

ไฟล์ที่ดัดแปลงจากต้นฉบับ Apache-2.0 ระบุไว้ที่หัวไฟล์หรือใน CHANGELOG ว่าแก้จากต้นฉบับ (Apache-2.0 §4b)

## MIT — Matt Pocock

```
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## MIT — GitHub, Inc.

```
MIT License

Copyright GitHub, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
