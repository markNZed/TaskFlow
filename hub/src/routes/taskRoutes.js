/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import { taskProcess_async } from "../taskProcess.mjs";

const router = express.Router();

router.post("/", async (req, res) => {
  console.log(""); // Empty line
  console.log("/hub/api/task");
  let userId = utils.getUserId(req);
  if (userId) {
    let task = req.body.task;
    task = await taskProcess_async(task, req, res);
  } else {
    console.log("No user");
    res.status(500).json({ error: "No user" });
  }
});

export default router;


