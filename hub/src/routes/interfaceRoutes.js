/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import { users, groups, tasks } from "../configdata.mjs";
import { hubId } from "../../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("/hub/api/interface");
  let userId = utils.getUserId(req);
  let authorised_tasks = {};
  for (const key in tasks) {
    if (utils.authenticatedTask(tasks[key], userId, groups)) {
      authorised_tasks[key] = tasks[key];
    }
  }
  // If a taskflow is authorized then the path to that taskflow is authorized
  for (const key in authorised_tasks) {
    let id = tasks[key].id
    let paths = id.split('.');
    let result = [];
    for (let i = 0; i < paths.length; i++) {
      result.push(paths.slice(0, i + 1).join('.'));
    }
    result.forEach(path => {
      if (!authorised_tasks[path]) {
        authorised_tasks[path] = tasks[path];
      }
    });
  }
  //console.log("authorised_tasks ", authorised_tasks)
  let tasksTree = {};
  for (const key in authorised_tasks) {
    let wf = authorised_tasks[key];
    // This should probably be a separate menu config
    // This is a hack to put the label back after change to v02 schema
    if (wf?.config?.label) {
      wf['label'] = wf.config.label;
    }
    if (wf.initiator === undefined) {
      const hasStart = key.endsWith(".start") ? true : false;
      let initiator;
      if (hasStart) {
        if (authorised_tasks[key].initiator === false) {
          initiator = false;
        } else {
          initiator = true;
        }
      }
      wf['initiator'] = initiator;
    }
    wf['childrenId'] = wf.meta.childrenId;
    tasksTree[key] = utils.filter_in_list(wf, [
      "id",
      "childrenId",
      "label",
      "initiator",
      "menu",
    ]);
  }
  //console.log("tasksTree ", tasksTree)
  if (userId) {
    console.log("Send Task tree ", userId);
    res.send({
      user: {
        userId: userId,
        interface: users[userId]?.interface,
        label: users[userId]?.label,
      },
      hubId: hubId,
      taskflowsTree: tasksTree,
    });
  } else {
    res.send({ userId: "" });
  }
});

// Export the router
export default router;
