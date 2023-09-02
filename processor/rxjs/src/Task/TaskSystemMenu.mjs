/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { tasksStore_async, groupsStore_async } from "../storage.mjs";
import { utils } from "../utils.mjs";

// eslint-disable-next-line no-unused-vars
const TaskSystemMenu_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  async function getAuthorisedTasks_async(userId, groupsStore_async) {
    //console.log("getAuthorisedTasks_async", userId);
    let authorised_tasks = {};
    let tasksTree = {};
    // Must use key, value as this is the entries in tasksStore_async 
    for await (const { key, value } of tasksStore_async.iterate()) {
      if (await utils.authenticatedTask_async(value, userId, groupsStore_async)) {
        authorised_tasks[key] = value;
        //console.log("task key authorised", key);
      } else {
        //console.log("task key not authorised", key);
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
    return tasksTree;
  }

  switch (T("state.current")) {
    case "start": {
      const tasksTree = await getAuthorisedTasks_async(T("user.id"), groupsStore_async);
      T("state.tasksTree", tasksTree);
      T("state.current", "loaded");
      T("command", "update");
      break;
    }
    case "loaded":
      break;
    case "ready":
      break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemMenu_async };
