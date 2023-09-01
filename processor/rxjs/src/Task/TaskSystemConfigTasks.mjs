/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { buildTree_async } from "./TaskSystemConfigTasks/configTasks.mjs";
import { tasksStore_async } from "../storage.mjs";
import _ from 'lodash';
import { utils } from "../utils.mjs";
import memoize from 'memoizee';

// We have cacheStore_async provided by storage.mjs but experimenting with memoize
// Can invalidate the memoize cache by updating configTreeUpdatedAt
// eslint-disable-next-line no-unused-vars
const m_buildTree_async = memoize(async (configTreeUpdatedAt) => {
  return buildTree_async();
}, { promise: true });

let configTree;
let configTreeUpdatedAt = Date();

// eslint-disable-next-line no-unused-vars
const TaskSystemConfigTasks_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  /*
   Load the tasks config from Redis
     Where does it get the connection info from ?
       Part of the task configuration
  */

  function removeSameProperties(objA, objB) {
    if ((!_.isObject(objA) && _.isObject(objB)) || 
        (_.isObject(objA) && !_.isObject(objB))
    ) {
      return;
    }
    for (const key in objB) {
      if ((!_.isObject(objA[key]) && _.isObject(objB[key])) ||
          (_.isObject(objA[key]) && !_.isObject(objB[key]))
      ) {
        // Do nothing
      } else if (_.isEqual(objA[key], objB[key])) {
        // If the property in objB is the same as that in objA, delete it
        delete objB[key];
      } else if (_.isObject(objB[key]) && _.isObject(objA[key])) {
        // If the property is another object, dive deeper
        removeSameProperties(objA[key], objB[key]);
        // If after removing properties recursively, an object becomes empty, remove it too
        if (_.isEmpty(objB[key])) {
          delete objB[key];
        }
      }
    }
  }

  switch (T("state.current")) {
    case "start": {
      configTree = await m_buildTree_async(configTreeUpdatedAt);
      T("state.configTree", configTree);
      T("state.current", "loaded");
      T("command", "update");
      break;
    }
    case "loaded": {
      const id = T("request.selectedTaskId");
      if (id) {
        // Could us promise.all to fetch in parallel
        console.log("selectedTask", id);
        const requestedTask = await tasksStore_async.get(id);
        const requestedTaskParent = await tasksStore_async.get(requestedTask?.meta?.parentId);
        const diff = JSON.parse(JSON.stringify(requestedTask));
        removeSameProperties(requestedTaskParent, diff);
        T("response.task", requestedTask);
        T("response.taskDiff", diff);
        T("state.current", "taskLoaded");
        T("command", "update");
      }
      break;
    }
    case "taskLoaded":
      break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemConfigTasks_async };
