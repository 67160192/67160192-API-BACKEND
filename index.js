require("dotenv").config();

const express = require("express");

const helmet = require("helmet");

const cors = require("cors");

const morgan = require("morgan");

const app = express();

const PORT = process.env.PORT || 3000;

// ลำดับ middleware มีความสำคัญ: security header → CORS → logger → body parser

// (ลำดับนี้ต่างจากแผนภาพตัวอย่างในหัวข้อ 1.2 ของ wk04.md ซึ่งวาง Logger ไว้ก่อน Helmet

// ทั้งสองลำดับใช้ได้ ตราบใดที่ Error-Handling Middleware ยังอยู่ท้ายสุดเสมอ)

app.use(helmet());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

app.use(morgan("dev"));

app.use(express.json({ limit: "10kb" }));

// ... route ทั้งหมดจากสัปดาห์ที่ 1-3 อยู่ต่อจากนี้ ...

const { graphqlHTTP } = require("express-graphql");

const schema = require("./schema");

const root = require("./resolvers");

app.use(
  "/graphql",

  graphqlHTTP({
    schema: schema,

    rootValue: root,

    graphiql: true,
  }),
);

app.use(express.json());

// url endpoint สำหรับตรวจสถานะของ API

app.get("/", (req, res) => {
  res.status(200).json({ message: "student API พร้อมใช้งาน" });
});

const pool = require("./db");

const { parsePagination, parseSort } = require("./middlewares/query-parser");

app.get("/students", parsePagination, parseSort, async (req, res, next) => {
  const { major } = req.query;
  const { page, limit, offset } = req.pagination;
  const { field, order } = req.sort;

  let baseQuery = "SELECT * FROM students";
  let countQuery = "SELECT COUNT(*) AS total FROM students";
  const params = [];

  if (major) {
    baseQuery += " WHERE major = ?";
    countQuery += " WHERE major = ?";
    params.push(major);
  }

  // แทรก field/order ลง SQL ได้โดยตรงเฉพาะเพราะผ่าน allowlist ใน parseSort มาแล้ว
  // ห้ามนำรูปแบบนี้ไปใช้กับค่าจาก req อื่นที่ไม่ได้ผ่าน allowlist
  baseQuery += ` ORDER BY ${field} ${order} LIMIT ? OFFSET ?`;

  try {
    const [rows] = await pool.query(baseQuery, [...params, limit, offset]);
    const [[{ total }]] = await pool.query(countQuery, params);

    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});
const v1Router = express.Router();

v1Router.get(
  "/students",
  parsePagination,
  parseSort,
  async (req, res, next) => {
    const { major } = req.query;
    const { page, limit, offset } = req.pagination;
    const { field, order } = req.sort;

    let baseQuery = "SELECT * FROM students";
    let countQuery = "SELECT COUNT(*) AS total FROM students";
    const params = [];

    if (major) {
      baseQuery += " WHERE major = ?";
      countQuery += " WHERE major = ?";
      params.push(major);
    }

    // แทรก field/order ลง SQL ได้โดยตรงเฉพาะเพราะผ่าน allowlist ใน parseSort มาแล้ว
    // ห้ามนำรูปแบบนี้ไปใช้กับค่าจาก req อื่นที่ไม่ได้ผ่าน allowlist
    baseQuery += ` ORDER BY ${field} ${order} LIMIT ? OFFSET ?`;

    try {
      const [rows] = await pool.query(baseQuery, [...params, limit, offset]);
      const [[{ total }]] = await pool.query(countQuery, params);

      res.status(200).json({
        message: "สำเร็จ",
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
const v2Router = express.Router();

v2Router.get("/students", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students");
    // v2 ปรับโครงสร้างผลลัพธ์ใหม่ ไม่มี wrapper "message" เหมือน v1
    res.status(200).json({ items: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

app.use("/api/v2", v2Router);

// ... route อื่น ๆ ทั้งหมดของ v1 (register, login, courses ฯลฯ) ย้ายมาไว้ที่นี่ในลักษณะเดียวกัน ...

app.use("/api/v1", v1Router);

app.get("/api/v1/students/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนิสิต" },
      });
    }

    res.status(200).json({ message: "สำเร็จ", data: rows[0] });
  } catch (err) {
    next(err);
  }
});

app.post("/api/v1/students", async (req, res, next) => {
  // ... โค้ดเดิมสำหรับตรวจสอบและเพิ่มข้อมูล ...

  try {
    const [result] = await pool.query(
      "INSERT INTO students (name, major, email) VALUES (?, ?, ?)",
      [name, major, email],
    );

    await redisClient.del("students:all"); // ล้างแคชเนื่องจากข้อมูลเปลี่ยนแปลงแล้ว

    res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: { id: result.insertId, name, major, email },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

//โค้ดเกี่ยวกับ Password
const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("./auth-helpers");

app.post("/api/v1/auth/register", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    const passwordHash = await hashPassword(password);
    const [result] = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'student')",
      [email, passwordHash],
    );

    res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      data: { id: result.insertId, email, role: "student" },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

app.post("/api/v1/auth/login", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    const user = rows[0];
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    const token = generateToken(user);
    res.status(200).json({ message: "เข้าสู่ระบบสำเร็จ", token });
  } catch (err) {
    next(err);
  }
});

app.post("/api/v1/students/:id/enrollments", async (req, res, next) => {
  const studentId = req.params.id;

  const { courseId } = req.body;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [courseRows] = await connection.query(
      "SELECT * FROM courses WHERE id = ? FOR UPDATE",

      [courseId],
    );

    if (courseRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        error: { code: "COURSE_NOT_FOUND", message: "ไม่พบรายวิชาที่ระบุ" },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      await connection.rollback();

      return res.status(409).json({
        error: { code: "SEAT_FULL", message: "ที่นั่งเต็มแล้ว" },
      });
    }

    await connection.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",

      [studentId, courseId],
    );

    await connection.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",

      [courseId],
    );

    await connection.commit();

    res.status(201).json({ message: "ลงทะเบียนสำเร็จ" });
  } catch (err) {
    await connection.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",

          message: "นิสิตลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }

    next(err);
  } finally {
    connection.release();
  }
});

// ==========================================

// 📌 แบบฝึกหัดที่ 1: GET ดึงข้อมูลรายวิชาทั้งหมด

// ==========================================

app.get("/api/v1/courses", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM courses");

    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// ==========================================

// 📌 แบบฝึกหัดที่ 2: GET ดึงรายการวิชาที่นิสิตลงทะเบียนไว้

// ==========================================

app.get("/api/v1/students/:id/courses", async (req, res, next) => {
  const studentId = req.params.id;

  try {
    const [studentRows] = await pool.query(
      "SELECT * FROM students WHERE id = ?",

      [studentId],
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนิสิต" },
      });
    }

    const sql = `

SELECT c.id, c.course_name, c.credit

FROM enrollments e

JOIN courses c ON e.course_id = c.id

WHERE e.student_id = ?

`;

    const [courses] = await pool.query(sql, [studentId]);

    res.status(200).json({ message: "สำเร็จ", data: courses });
  } catch (err) {
    next(err);
  }
});

// ==========================================

// 📌 แบบฝึกหัดที่ 3: DELETE ถอนการลงทะเบียนวิชา (พร้อมคืนที่นั่ง +1)

// ==========================================

app.delete(
  "/api/v1/students/:id/enrollments/:courseId",

  async (req, res, next) => {
    const { id: studentId, courseId } = req.params;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        "DELETE FROM enrollments WHERE student_id = ? AND course_id = ?",

        [studentId, courseId],
      );

      if (result.affectedRows === 0) {
        await connection.rollback();

        return res.status(404).json({
          error: {
            code: "ENROLLMENT_NOT_FOUND",

            message: "ไม่พบข้อมูลการลงทะเบียนรายวิชานี้",
          },
        });
      }

      await connection.query(
        "UPDATE courses SET seat_available = seat_available + 1 WHERE id = ?",

        [courseId],
      );

      await connection.commit();

      res.status(200).json({ message: "ถอนการลงทะเบียนสำเร็จ" });
    } catch (err) {
      await connection.rollback();

      next(err);
    } finally {
      connection.release();
    }
  },
);

const { authenticateToken, authorizeRole } = require("./middlewares/auth");
app.delete(
  "/api/v1/students/:id",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res, next) => {
    try {
      const [result] = await pool.query("DELETE FROM students WHERE id = ?", [
        req.params.id,
      ]);
      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนิสิต" },
        });
      }
      res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
    } catch (err) {
      next(err);
    }
  },
);

// เพิ่ม route ใหม่: เฉพาะผู้ที่ล็อกอินแล้วเท่านั้นที่ดูข้อมูลของตนเองได้
app.get("/api/v1/auth/me", authenticateToken, (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: req.user });
});
// 404: ไม่พบ route ที่ร้องขอ (ต้องอยู่หลัง route ทั้งหมด)

app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// Error-handling middleware (ต้องมีพารามิเตอร์ 4 ตัวเสมอ)

app.use((err, req, res, next) => {
  console.error(err.stack);

  // ใช้ err.status/err.statusCode หากมี (เช่น PayloadTooLargeError จาก express.json ที่ส่งมาเป็น 413)

  // เพื่อไม่ให้ error ที่มีรหัสสถานะของตัวเองถูกกลบด้วย 500 เสมอไป

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",

      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});
const { redisClient, connectRedis } = require("./cache");

connectRedis()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server กำลังทำงานที่พอร์ต ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("เชื่อมต่อ Redis ไม่สำเร็จ เซิร์ฟเวอร์จะไม่เริ่มทำงาน:", err);
    process.exit(1);
  });

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`);
});
