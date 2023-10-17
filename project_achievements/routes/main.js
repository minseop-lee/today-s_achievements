// 필요한 모듈 불러오기
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const pool = require("../../config/pool");
const { promisify } = require("util");
const env = require("dotenv").config({ path: "../../.env" });

// MySQL 데이터베이스 연결 설정
const connection = mysql
  .createConnection({
    host: process.env.host,
    user: process.env.user,
    password: process.env.password,
    database: process.env.database,
  })
  .promise();

// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 업적 정보 저장 API
app.post("/insert", async (req, res) => {
  const { subject, task } = req.body;

  try {
    await connection.beginTransaction();

    const tasks = task.split(","); // 입력 받은 작업을 쉼표로 분리

    // 각 작업을 데이터베이스에 저장
    for (let t of tasks) {
      await connection.query("INSERT INTO achievements SET ?", {
        subject: subject,
        task: t.trim(),
      });
    }

    await connection.commit();

    // MongoDB에서 업적 정보 조회
    let mongoAchievement = await Achievement.findOne({ subject: subject });

    // 업적 정보가 없으면 새로 생성
    if (!mongoAchievement) {
      mongoAchievement = new Achievement({ subject: subject });
    }

    const maxSalary = 908538;
    const salaryPerPoint = maxSalary / 100; // 포인트 당 증가하는 금액

    // 포인트 및 급여 업데이트
    mongoAchievement.points += tasks.length;
    mongoAchievement.salary = Math.round(
      mongoAchievement.points * salaryPerPoint
    );

    // MongoDB에 업적 정보 저장
    await mongoAchievement.save();

    res.status(200);
    res.send('{ "ok": true }');
    console.log('{ "ok": true }');
  } catch (err) {
    await connection.rollback();

    console.error(err);
    res.status(500).send("데이터베이스 오류가 발생했습니다.");
    console.log('{ "ok": false }');
  }
});

// 업적 목록 조회 API
app.get("/tasks/:subject", async (req, res) => {
  const { subject } = req.params;

  try {
    // 데이터베이스에서 업적 목록 조회
    const [results] = await connection.query(
      "SELECT * FROM achievements WHERE subject = ?",
      [subject]
    );

    res.status(200);
    res.json({ ok: true, result: results });
    console.log('{"ok":true,' + JSON.stringify(results));
  } catch (err) {
    console.error(err);
    res.status(500).send("select error");
    res.send('{ "ok": false }');
    console.log('{ "ok": false }');
  }
});

// 누적 업적 정보 조회 API
app.get("/achievement/:subject", async (req, res) => {
  const { subject } = req.params;
  try {
    // MongoDB에서 업적 정보 조회
    const mongoAchievement = await Achievement.findOne({ subject: subject });

    // 업적 정보가 없으면 에러 메시지 반환
    if (!mongoAchievement) {
      res.status(404).json({ ok: false, message: "업적이 없습니다." });
      console.log('{ "ok": false }');
      return;
    }

    // 누적 업적 정보 반환
    res.status(200);
    res.json({
      ok: true,
      points: mongoAchievement.points,
      salary: mongoAchievement.salary,
    });

    console.log(
      '{"ok":true,' +
        JSON.stringify({
          points: mongoAchievement.points,
          salary: mongoAchievement.salary,
        })
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("select error");
    res.send('{ "ok": false }');
    console.log('{ "ok": false }');
  }
});

// MongoDB 연결 및 스키마 정의
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
mongoose.connect("mongodb://192.168.1.198:27017/test");

const achievementSchema = mongoose.Schema(
  {
    subject: String,
    points: { type: Number, default: 0 },
    salary: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
  },
  { versionKey: false }
);

// 업적 모델 생성
const Achievement = mongoose.model("Achievement", achievementSchema);

// app 모듈 내보내기
module.exports = app;
