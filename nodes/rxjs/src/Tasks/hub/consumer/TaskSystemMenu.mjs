/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { tasksStore_async, usersStore_async, tribesStore_async } from "#src/storage";
import { utils } from "#src/utils";

// eslint-disable-next-line no-unused-vars
const TaskSystemMenu_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  //if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  utils.debugTask(T());

  let configTreeEvent; 
  if (utils.checkModified(T(), "shared.system.config-hub-consumer-tasks")) {
    configTreeEvent = true;
    utils.logTask(T(), "configTreeEvent found update to shared.system.config-hub-consumer-tasks");
  }

  function deleteNonInitiatorBranches(tasks) {
    // Helper function to determine if a task should be deleted
    function shouldDeleteTask(task) {
      return !task.initiator && (!task.meta?.childrenId || task.meta.childrenId.length === 0);
    }
    // Recursive function to delete non-initiator leaf nodes and their parents if applicable
    function recursiveDelete(taskKey, tasks, parentKey = null) {
      const task = tasks[taskKey];
      if (!task) return true;
  
      // Process all children first
      if (task.meta?.childrenId && task.meta.childrenId.length > 0) {
        // Use a reverse loop for safe removal of items during iteration
        for (let i = task.meta.childrenId.length - 1; i >= 0; i--) {
          const childKey = task.meta.childrenId[i];
          if (recursiveDelete(childKey, tasks, taskKey)) {
            // Remove the deleted child from the childrenId array
            task.meta.childrenId.splice(i, 1);
          }
        }
      }
      // After processing children, check if the task itself should be deleted
      if (shouldDeleteTask(task)) {
        // If this task has a parent, defer deletion to the parent's check
        if (parentKey) {
          return true; // Signify that this task should be deleted
        } else {
          delete tasks[taskKey]; // Delete the task if it has no parent (root-level task)
        }
      }
      // If a task was marked for deletion (child returned true), handle deletion here
      if (parentKey && shouldDeleteTask(tasks[parentKey])) {
        delete tasks[parentKey]; // Delete the parent task
        return true; // Propagate deletion signal up the stack
      }
      return false; // Task was not deleted, do not propagate deletion signal
    }
  
    // Start the recursion from the root tasks
    Object.keys(tasks).forEach(taskKey => recursiveDelete(taskKey, tasks));
  }

  async function getAuthorisedTasks_async(userId, tribeId, tasksStore_async, sort = false) {
    //utils.logTask(T(), "getAuthorisedTasks_async", userId, tribeId);
    let authorised_tasks = {};
    let tasksTree = {};
    // This is particularly slow - many seconds
    const [tribe, user] = await Promise.all([
      tribesStore_async.get(tribeId),
      usersStore_async.get(userId)
    ]);
    const userGroupIds = user.groupIds;
    const userGroupIdsInTribe = await utils.filterGroupIdsInTribe_async(userGroupIds, tribe);
    //utils.logTask(T(), "getAuthorisedTasks_async userGroupIds", userGroupIds, "userGroupIdsInTribe", userGroupIdsInTribe);
    let taskPromises = [];
    // The iterator is slow
    // Could store in a single hash instead of individual entries then no need to iterate
    // Could have a "permissions" store that only has that info (task.permissions) in a Map
    // Need to keep it in sync with  tasksStore_async (and initialize) 
    const taskPermissionsString = await tasksStore_async.get("taskPermissions");
    const taskPermissions = taskPermissionsString;
    for (const [key, value] of Object.entries(taskPermissions)) {
      const taskPromise = utils.authenticatedTask_async(key, value, userGroupIdsInTribe)
        // eslint-disable-next-line no-unused-vars
        .then(async ([authenticated, groupId]) => {
          if (authenticated) {
            authorised_tasks[key] = await tasksStore_async.get(key);
            //utils.logTask(T(), "getAuthorisedTasks_async authorised_tasks", Object.keys(authorised_tasks).length);
          }
        });
  
      taskPromises.push(taskPromise);
    }
    // Wait for all tasks to be processed
    //utils.logTask(T(), "getAuthorisedTasks_async authorised_tasks promises done");
    await Promise.all(taskPromises);
    //utils.logTask(T(), "getAuthorisedTasks_async authorised_tasks", Object.keys(authorised_tasks).length);
    deleteNonInitiatorBranches(authorised_tasks);
    taskPromises = [];
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
          // Create a promise for each task and store it
          const taskPromise = tasksStore_async.get(path).then(task => {
            authorised_tasks[path] = task;
          });
          taskPromises.push(taskPromise);
        }
      }
      await Promise.all(taskPromises);
    }
    //utils.logTask(T(), "getAuthorisedTasks_async paths", Object.keys(authorised_tasks).length);
    let keys = Object.keys(authorised_tasks);
    if (sort) {
        keys = keys.sort((keyA, keyB) => {
            const labelA = authorised_tasks[keyA].config?.label || '';
            const labelB = authorised_tasks[keyB].config?.label || '';
            return labelA.localeCompare(labelB);
        });
    }
    for (const key of keys) {
      let wf = authorised_tasks[key];
      // This should probably be a separate menu config
      // This is a hack to put the label back after change to v02 schema
      if (wf?.config?.label) {
        wf['label'] = wf.config.label;
      }
      wf['childrenId'] = wf.meta.childrenId;
      if (sort && wf['childrenId']) {
        wf['childrenId'] = wf['childrenId'].sort((childA, childB) => {
            const childLabelA = authorised_tasks[childA]?.config?.label || '';
            const childLabelB = authorised_tasks[childB]?.config?.label || '';
            return childLabelA.localeCompare(childLabelB);
        });
      }
      tasksTree[key] = utils.filter_in_list(wf, [
        "id",
        "childrenId",
        "label",
        "initiator",
        "menu",
      ]);
    }
    //utils.logTask(T(), "getAuthorisedTasks_async done tasksTree", Object.keys(tasksTree).length);
    return tasksTree;
  }

  switch (T("state.current")) {
    case "start": {
      // This will turn init into update
      const tasksTree = await getAuthorisedTasks_async(T("user.id"), T("tribeId"), tasksStore_async, T("config.sort"));
      T("state.tasksTree", tasksTree);
      T("state.current", "loaded");
      T("command", "update");
      T("commandDescription", "Initialise state.tasksTree");
      break;
    }
    case "loaded":
      break;
    case "ready":
      if (configTreeEvent) {
        const newTasksTree = await getAuthorisedTasks_async(T("user.id"), T("tribeId"), tasksStore_async, T("config.sort"));
        const oldTasksTree = T("state.tasksTree");
        // There was a very nast issue where a key in the tasksTree could be set to undefined in getAuthorisedTasks_async
        // Then the conversion of the object to JSON will remove the key and deepEqual would see a difference in the number of keys
        // deepEqual was modified to remove undefined keys
        const treeSize = newTasksTree ? Object.keys(newTasksTree).length : 0;
        if (treeSize && !utils.deepEqual(newTasksTree, oldTasksTree)) {
          //utils.logTask(T(), "state.tasksTree getObjectDifference", utils.getObjectDifference(newTasksTree, oldTasksTree));
          //utils.logTask(T(), "newTasksTree", newTasksTree);
          //utils.logTask(T(), "oldTasksTree", oldTasksTree);
          T("state.tasksTree", newTasksTree);
          T("command", "update");
          T("commandDescription", "Update state.tasksTree due to configTreeEvent so React can see it.");
        } else {
          utils.logTask(T(), `In state ready but no difference in state.tasksTree ${treeSize}`,);
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
    utils.logTask(T(), "No state.tasksTree no state.tasksTree");
  }

  return T();
};

export { TaskSystemMenu_async };
