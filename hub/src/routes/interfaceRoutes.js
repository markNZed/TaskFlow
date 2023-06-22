/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import { users, groups, taskflows } from "../configdata.mjs";
import { hubId } from "../../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("/hub/api/interface");
  let userId = utils.getUserId(req);
  let authorised_taskflows = {};
  for (const key in taskflows) {
    if (utils.authenticatedTask(taskflows[key], userId, groups)) {
      authorised_taskflows[key] = taskflows[key];
    }
  }
  // If a taskflow is authorized then the path to that taskflow is authorized
  for (const key in authorised_taskflows) {
    let id = taskflows[key].id
    let paths = id.split('.');
    let result = [];
    for (let i = 0; i < paths.length; i++) {
      result.push(paths.slice(0, i + 1).join('.'));
    }
    result.forEach(path => {
      if (!authorised_taskflows[path]) {
        authorised_taskflows[path] = taskflows[path];
      }
    });
  }
  //console.log("authorised_taskflows ", authorised_taskflows)
  let taskflowsTree = {};
  for (const key in authorised_taskflows) {
    let wf = authorised_taskflows[key];
    // This should probably be a separate menu config
    // This is a hack to put the label back after change to v02 schema
    if (wf?.config?.label) {
      wf['label'] = wf.config.label;
    }
    if (wf.initiator === undefined) {
      const hasStart = authorised_taskflows[key]?.tasks?.start ? true : false
      let initiator;
      if (hasStart) {
        if (authorised_taskflows[key].tasks.start.initiator === false) {
          initiator = false;
        } else {
          initiator = true;
          // This seems very hacky
          wf.stackTaskId = wf.tasks.start.stackTaskId;
        }
      }
      wf['initiator'] = initiator;
    }
    taskflowsTree[key] = utils.filter_in_list(wf, [
      "id",
      "children",
      "label",
      "initiator",
      "menu",
      "stackTaskId"
    ]);
  }
  //console.log("taskflowsTree ", taskflowsTree)
  if (userId) {
    console.log("Send Task tree ", userId);
    res.send({
      user: {
        userId: userId,
        interface: users[userId]?.interface,
        label: users[userId]?.label,
      },
      hubId: hubId,
      taskflowsTree: taskflowsTree,
    });
  } else {
    res.send({ userId: "" });
  }
});

// Export the router
export default router;
