/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { } from "../../config.mjs";
import { utils } from "../utils.mjs";
import * as dotenv from "dotenv";
dotenv.config();
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get("/", async (req, res) => {
  console.log("/auth request", utils.getSourceIP(req))

  // Extract token from cookies
  const authToken = req.cookies.authToken;

  if (!authToken) {
    return res.status(401).send("Unauthorized: No authToken provided");
  }

  const JWT_SECRET = process.env.JWT_SECRET || "nojwtsecret";

  try {
    // Verify authToken
    const decoded = jwt.verify(authToken, JWT_SECRET);
    console.log("JWT decoded", decoded);
    if (!decoded.hostname) {
      // old JWT so reauthenticate
      throw new Error("Invalid JWT missing hostname");
    }

    // Token is valid, proceed with request
    res.status(200).send("Authorized");
  } catch (err) {
    // Token is not valid
    res.status(401).send("Unauthorized: Invalid token");
  }
});

// Export the router
export default router;
