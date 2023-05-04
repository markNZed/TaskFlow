/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { v4 as uuidv4 } from "uuid";
import { utils } from "../src/utils.mjs";
import { users, groups, workflows } from "./../src/configdata.mjs";
import { sessionsStore_async } from "./../src/storage.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.get("/", async (req, res) => {
  console.log("/api/session");
  let userId = utils.getUserId(req);
  const sessionId = uuidv4();
  let authorised_workflows = {};
  for (const key in workflows) {
    if (utils.authenticatedTask(workflows[key], userId, groups)) {
      authorised_workflows[key] = workflows[key];
    }
  }
  //console.log("authorised_workflows ", authorised_workflows)
  let workflowsTree = {};
  for (const key in authorised_workflows) {
    let wf = authorised_workflows[key];
    workflowsTree[key] = utils.filter_in_list(wf, [
      "id",
      "label",
      "children",
      "initiator",
    ]);
  }
  //console.log("workflowsTree ", workflowsTree)
  if (userId) {
    console.log("Creating session for ", userId);
    sessionsStore_async.set(sessionId + "userId", userId);
    res.send({
      user: {
        userId: userId,
        interface: users[userId]?.interface,
      },
      sessionId: sessionId,
      workflowsTree: workflowsTree,
    });
  } else {
    res.send({ userId: "" });
  }
});

// Export the router
export default router;
