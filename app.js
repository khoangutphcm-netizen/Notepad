const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your_email@gmail.com",
    pass: "your_app_password"
  }
});
const app = express();
app.use(cors({
 origin: ["http://127.0.0.1:5500", "http://localhost:5500", "https://your-frontend-domain.com"],
 methods: ["GET", "POST", "PUT", "DELETE"],
 credentials: true
}));
app.options("*", cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "gondola.proxy.rlwy.net",
  user: "root",
  password: "shSUOojpDFivvEDDpkrtGDJnoTVCTvkM",
  database: "railway",
  port: 54033
});

db.connect(err => {
  if (err) console.error("Lỗi DB:", err);
  else console.log("Connected MySQL");
});

// REGISTER
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = uuidv4();

    db.query(
      "INSERT INTO users (email, password_hash, activation_token) VALUES (?, ?, ?)",
      [email, hashedPassword, token],
      async (err) => {
        if (err) return res.send("Email already exists");

        // 🔥 gửi email
        const BASE_URL = "https://nginx-production-8f61.up.railway.app";
        const link = `${BASE_URL}/activate/${token}`;

        await transporter.sendMail({
          from: "your_email@gmail.com",
          to: email,
          subject: "Activate your account",
          html: `<h3>Click to activate:</h3>
                 <a href="${link}">${link}</a>`
        });

        res.send("Register success! Check your email.");
      }
    );

  } catch {
    res.send("Error");
  }
});

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
    if (err || result.length === 0) return res.send("Login failed");

    const user = result[0];

    if (!user.is_verified) {
      return res.send("Please verify your email first!");
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (match) {
      res.json({ user_id: user.id });
    } else {
      res.send("Login failed");
    }
  });
});

// ADD NOTE
app.post("/add-note", (req, res) => {
  const { user_id, title, content } = req.body;
  db.query(
    "INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)",
    [user_id, title, content],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ note_id: result.insertId });
    }
  );
});

// GET NOTES
app.get("/notes/:user_id", (req, res) => {
  db.query(
    "SELECT * FROM notes WHERE user_id = ?",
    [req.params.user_id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json(result);
    }
  );
});

// SEARCH
app.get("/search", (req, res) => {
  const { user_id, q } = req.query;
  const sql = "SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)";
  const keyword = "%" + q + "%";

  db.query(sql, [user_id, keyword, keyword], (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// DELETE
app.delete("/delete-note/:id", (req, res) => {
  db.query("DELETE FROM notes WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.send("Deleted");
  });
});

// UPDATE
app.put("/update-note/:id", (req, res) => {
  const { title, content } = req.body;
  db.query(
    "UPDATE notes SET title=?, content=? WHERE id=?",
    [title, content, req.params.id],
    (err) => {
      if (err) return res.status(500).send(err);
      res.send("Updated");
    }
  );
});

app.get("/", (req, res) => {
 res.send("OK");
});
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

app.get("/activate/:token", (req, res) => {
  const token = req.params.token;

  db.query(
    "UPDATE users SET is_verified = TRUE, activation_token = NULL WHERE activation_token = ?",
    [token],
    (err, result) => {
      if (result.affectedRows === 0) {
        return res.send("Invalid token");
      }
      res.send("Account activated!");
    }
  );
});

