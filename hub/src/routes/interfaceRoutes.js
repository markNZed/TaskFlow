/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import { usersStore_async, groupsStore_async, tasksStore_async } from "../storage.mjs";
import { hubId } from "../../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("/hub/api/interface");
  let userId = utils.getUserId(req);
  let authorised_tasks = {};
  // Must use key, value as this is the entries in tasksStore_async 
  for await (const { key, value } of tasksStore_async.iterate()) {
    //console.log("key, value", key, value);
    if (await utils.authenticatedTask_async(value, userId, groupsStore_async)) {
      authorised_tasks[key] = value;
    }
  }
  // If a taskflow is authorized then the path to that taskflow is authorized
  for (const key in authorised_tasks) {
    let id = authorised_tasks[key].id
    let paths = id.split('.');
    let result = [];
    for (let i = 0; i < paths.length; i++) {
      result.push(paths.slice(0, i + 1).join('.'));
    }
    for (const path of result) {
      if (!authorised_tasks[path]) {
        authorised_tasks[path] = await tasksStore_async.get(path);
      }
    }    
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
    const user = await usersStore_async.get(userId);
    console.log("Send Task tree", userId, user);
    res.send({
      user: {
        userId: userId,
        interface: user?.interface,
        label: user?.label,
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
