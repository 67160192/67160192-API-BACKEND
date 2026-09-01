## โครงสร้างของ JSON Web Token (JWT) เป็นมาตรฐาน (RFC 7519) แบบ Self-contained ประกอบด้วย 3 ส่วนคั่นด้วยจุด (`.`) คือ `Header.Payload.Signature`

### เหตุใด Token ที่ถูกแก้ไขเพียงตัวอักษรเดียวจึงถูกปฏิเสธ?

1. **การสร้าง Signature:** ฝั่ง Server นำข้อมูลส่วน `Header` และ `Payload` (ที่เก็บ `id` และ `role`) มาลงนามดิจิทัลร่วมกับความลับ **`JWT_SECRET`** เพื่อให้ได้ Signature สำหรับยืนยันว่าข้อมูลจะไม่ถูกดัดแปลง
2. **การตรวจสอบใน Middleware:** เมื่อยิงคำขอเข้าสู่ Protected Route ตัว Middleware `authenticateToken` ใน `middlewares/auth.js` จะทำการถอดรหัสและคำนวณ Signature จากข้อมูลที่ส่งมาใหม่อีกครั้งด้วย `JWT_SECRET` ตัวเดิม
3. **การดักจับการทุจริตข้อมูล (Data Tampering):** หาก Token ถูกดัดแปลงตัวอักษรแม้เพียงตัวเดียว (เช่น การทดสอบแก้ไข Token ในขั้นตอนที่ 3.7) Signature ที่ Server คำนวณได้ใหม่จะไม่ตรงกับ Signature ที่แนบมากับ Token
4. **การปฏิเสธคำขอ:** เมื่อ Signature ไม่ตรงกัน ระบบจะทราบทันทีว่า Token ไม่ถูกต้อง และทำการปฏิเสธคำขอทันที โดยตอบกลับด้วย **Status Code `401 Unauthorized`** พร้อมข้อความ `"code": "INVALID_TOKEN"` เพื่อความปลอดภัยของระบบ
