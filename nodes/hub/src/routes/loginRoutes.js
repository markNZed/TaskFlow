import bcrypt from 'bcrypt';
import express from "express";
import jwt from 'jsonwebtoken';
import { accessDB } from "../storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
  const { username, password: submittedPassword } = req.body;

  // Retrieve user by username
  accessDB.get("SELECT password_hash FROM users WHERE username = ?", [username], async (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }

    if (!row) {
      console.log("Invalid user /login from", req.ip, username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    try {
      const match = await bcrypt.compare(submittedPassword, row.password_hash);
      if (match) {
        const JWT_SECRET = process.env.JWT_SECRET || "nojwtsecret";
        // Generate JWT Token
        const authToken = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
        console.log("/login from", req.ip, username);
        res.json({ authToken });
      } else {
        console.log("Invalid password /login from", req.ip, username, submittedPassword);
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
