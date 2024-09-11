import bcrypt from 'bcrypt';
import express from "express";
import jwt from 'jsonwebtoken';
import { accessDB } from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
  const { username, password: submittedPassword } = req.body;
  const origin = req.get('origin');
  if (!origin) {
    return res.status(401).json({ message: "Empty origin" });
  }
  const url = new URL(origin);
  const hostname = url.hostname;

  // Retrieve user by username
  accessDB.get("SELECT password_hash FROM users WHERE LOWER(username) = LOWER(?)", [username], async (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }

    if (!row) {
      console.log(`Invalid user /login from ${hostname}`, req.ip, username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    try {
      const match = await bcrypt.compare(submittedPassword, row.password_hash);
      if (match) {
        const JWT_SECRET = process.env.JWT_SECRET || "nojwtsecret";
        // Generate JWT Token
        const authToken = jwt.sign({ username, hostname }, JWT_SECRET, { expiresIn: '7d' });
        console.log(`login from ${hostname}`, req.ip, username);
        res.json({ authToken });
      } else {
        console.log(`Invalid password /login from ${hostname}`, req.ip, username, submittedPassword);
        res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  });
});

// Export the router
export default router;
