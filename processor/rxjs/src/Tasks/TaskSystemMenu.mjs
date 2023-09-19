/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { tasksStore_async, groupsStore_async } from "../storage.mjs";
import { utils } from "../utils.mjs";

// eslint-disable-next-line no-unused-vars
const TaskSystemMenu_async = async function (wsSendTask, T, fsmHolder, CEPFuncs, services) {

  let configTreeEvent; 
  if (T("processor.commandArgs.sync")) {
    //console.log("TaskSystemMenu_async", T("processor.commandArgs"));
    if (T("meta.modified.shared.tasksConfigTree")) {
      configTreeEvent = true;
      console.log("configTreeEvent found update to shared.tasksConfigTree");
    } else {
      return null; // Ignore sync operations
    }
  }

  async function getAuthorisedTasks_async(userId, tasksStore_async, groupsStore_async, sort = false) {
    //console.log("getAuthorisedTasks_async", userId);
    let authorised_tasks = {};
    let tasksTree = {};
    for await (const [key, value] of tasksStore_async.iterator()) {
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
    let keys = []
    if (sort) {
      keys = Object.keys(authorised_tasks).sort();
    } else {
      keys = Object.keys(authorised_tasks);
    }
    for (const key of keys) {
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
      if (sort && wf['childrenId']) {
        wf['childrenId'] = wf['childrenId'].sort();
      }
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
      const tasksTree = await getAuthorisedTasks_async(T("user.id"), tasksStore_async, groupsStore_async, T("config.sort"));
      T("state.tasksTree", tasksTree);
      T("state.current", "loaded");
      T("command", "update");
      break;
    }
    case "loaded":
      break;
    case "ready":
      if (configTreeEvent) {
        const newTasksTree = await getAuthorisedTasks_async(T("user.id"), tasksStore_async, groupsStore_async, T("config.sort"));
        const oldTasksTree = T("state.tasksTree");
        if (!utils.deepEqual(newTasksTree, oldTasksTree)) {
          T("state.tasksTree", newTasksTree);
          T("command", "update");
        }
      }
      break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  if (T("state.tasksTree")) {
    utils.logTask(T(), "Length of state.tasksTree", Object.keys(T("state.tasksTree")).length);
  } else {
    utils.logTask(T(), "No state.tasksTree Length of state.tasksTree 0");
  }

  return T();
};

export { TaskSystemMenu_async };
