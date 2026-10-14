// Template: ตัวห่อ libmodbus สำหรับ Modbus TCP (ใช้กับ FX5UC)
// - ไม่ throw ออกไปนอก class: ทุกฟังก์ชันคืน bool, ข้อความ error อยู่ใน last_error()
// - reconnect แบบมีช่วงพัก (เรียก ensure_connected() ทุกรอบ timer ได้เลย)
// - อุปกรณ์ตอบ exception (address/ค่าผิด ฯลฯ) = connection ยังดี ไม่ตัด; error อื่น (timeout, CRC, สายหลุด) = ตัดแล้วต่อใหม่
// - helper แปลง int16 (ค่าติดลบ) และ 32-bit แบบ Mitsubishi (low word ก่อน)
#pragma once

#include <modbus/modbus.h>

#include <cerrno>
#include <chrono>
#include <cstdint>
#include <string>
#include <vector>

class ModbusTcpClient
{
public:
  // unit_id: ตั้งเฉพาะเมื่อปลายทางต้องใช้ (เช่น gateway TCP→RTU ใช้ unit ID เลือกอุปกรณ์บน RS-485)
  //          -1 = ไม่ตั้ง ใช้ค่าเริ่มต้นของ libmodbus (0xFF) — ห้ามเดาค่า ให้ดูจากคู่มือ/CLAUDE.md ของโปรเจกต์
  ModbusTcpClient(std::string ip, int port, double timeout_s = 0.2, double retry_s = 1.0, int unit_id = -1)
  : ip_(std::move(ip)), port_(port), timeout_s_(timeout_s), retry_s_(retry_s), unit_id_(unit_id) {}

  ~ModbusTcpClient() {disconnect();}
  ModbusTcpClient(const ModbusTcpClient &) = delete;
  ModbusTcpClient & operator=(const ModbusTcpClient &) = delete;

  bool connected() const {return ctx_ != nullptr;}
  const std::string & last_error() const {return last_error_;}
  // true = คำสั่งล่าสุดล้มเหลวเพราะอุปกรณ์ตอบ exception (เช่น illegal data address) — แก้ address/ค่า ไม่ใช่ปัญหาสาย
  bool last_was_device_exception() const {return last_device_exception_;}

  // เรียกได้ทุกรอบ: ถ้ายังต่ออยู่คืน true, ถ้าหลุดจะลองต่อใหม่ไม่ถี่กว่า retry_s
  bool ensure_connected()
  {
    if (ctx_) {return true;}
    auto now = std::chrono::steady_clock::now();
    if (now - last_attempt_ < std::chrono::duration<double>(retry_s_)) {return false;}
    last_attempt_ = now;

    ctx_ = modbus_new_tcp(ip_.c_str(), port_);
    if (!ctx_) {return fail("modbus_new_tcp");}
    if (unit_id_ >= 0 && modbus_set_slave(ctx_, unit_id_) == -1) {
      bool r = fail("set unit id " + std::to_string(unit_id_));
      modbus_free(ctx_);
      ctx_ = nullptr;
      return r;
    }
    auto sec = static_cast<uint32_t>(timeout_s_);
    auto usec = static_cast<uint32_t>((timeout_s_ - sec) * 1e6);
    modbus_set_response_timeout(ctx_, sec, usec);
    if (modbus_connect(ctx_) == -1) {
      bool r = fail("connect " + ip_ + ":" + std::to_string(port_));
      modbus_free(ctx_);
      ctx_ = nullptr;
      return r;
    }
    return true;
  }

  void disconnect()
  {
    if (ctx_) {
      modbus_close(ctx_);
      modbus_free(ctx_);
      ctx_ = nullptr;
    }
  }

  // FC03 อ่าน holding register เป็นบล็อก (address แบบ 0-based)
  bool read_registers(int addr, int count, std::vector<uint16_t> & out)
  {
    if (!ctx_) {return fail_nc();}
    out.assign(count, 0);
    if (modbus_read_registers(ctx_, addr, count, out.data()) != count) {return drop("read_registers");}
    return true;
  }

  // FC16 เขียน holding register หลายตัวในครั้งเดียว
  bool write_registers(int addr, const std::vector<uint16_t> & values)
  {
    if (!ctx_) {return fail_nc();}
    int n = static_cast<int>(values.size());
    if (modbus_write_registers(ctx_, addr, n, values.data()) != n) {return drop("write_registers");}
    return true;
  }

  // FC01 อ่าน coil
  bool read_bits(int addr, int count, std::vector<uint8_t> & out)
  {
    if (!ctx_) {return fail_nc();}
    out.assign(count, 0);
    if (modbus_read_bits(ctx_, addr, count, out.data()) != count) {return drop("read_bits");}
    return true;
  }

  // FC15 เขียน coil หลายตัวในครั้งเดียว (เช่น m_forward + m_backward พร้อมกัน)
  bool write_bits(int addr, const std::vector<uint8_t> & values)
  {
    if (!ctx_) {return fail_nc();}
    int n = static_cast<int>(values.size());
    if (modbus_write_bits(ctx_, addr, n, values.data()) != n) {return drop("write_bits");}
    return true;
  }

  // ---- helper แปลงค่า ----
  static uint16_t from_int16(int16_t v) {return static_cast<uint16_t>(v);}
  static int16_t to_int16(uint16_t r) {return static_cast<int16_t>(r);}
  // Mitsubishi 32-bit: D(n) = low word, D(n+1) = high word
  static int32_t to_int32_lo_hi(uint16_t lo, uint16_t hi)
  {
    return static_cast<int32_t>(static_cast<uint32_t>(lo) | (static_cast<uint32_t>(hi) << 16));
  }

private:
  bool fail(const std::string & what)
  {
    last_device_exception_ = false;
    last_error_ = what + ": " + modbus_strerror(errno);
    return false;
  }
  bool fail_nc()
  {
    last_device_exception_ = false;
    last_error_ = "not connected";
    return false;
  }
  // error ระหว่างใช้งาน:
  // - อุปกรณ์ตอบ exception (EMBXILFUN..EMBXGTAR) → connection ยังดี คงไว้ (ตัดทิ้งจะ reconnect วนทุกรอบ และปน "address ผิด" กับ "สายหลุด")
  // - อย่างอื่น (timeout, CRC/ข้อมูลตอบกลับผิดรูป, socket error) → ปิด ให้ ensure_connected() ต่อใหม่รอบหน้า
  //   ข้อมูลตอบกลับผิดรูปอาจแปลว่า stream เลื่อนแล้ว — ต่อใหม่ปลอดภัยกว่าอ่านต่อ
  bool drop(const std::string & what)
  {
    const int err = errno;
    fail(what);
    if (err >= EMBXILFUN && err <= EMBXGTAR) {
      last_device_exception_ = true;
      return false;
    }
    disconnect();
    return false;
  }

  std::string ip_;
  int port_;
  double timeout_s_, retry_s_;
  int unit_id_;
  bool last_device_exception_{false};
  modbus_t * ctx_{nullptr};
  std::string last_error_;
  std::chrono::steady_clock::time_point last_attempt_{};
};
