/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { threadsStore_async, instancesStore_async } from "./../src/storage.mjs";
import { utils } from "../src/utils.mjs";

const TaskShowResponse_async = async function (task) {
  const T = utils.createTaskValueGetter(task);

  console.log("TaskShowResponse name " + T("name"));

  let response = "";

  if (task.id.endsWith(".error")) {
    // Fetch the previous task
    const prevTask = await instancesStore_async.get(task.parentInstanceId)
    response = "ERROR: " + prevTask.error
    console.log("Set error from previous task", prevTask.error)
  }

  let threadTasks = {};
  const parentId = T("parentId");
  if (T("config.promptTemplate") || T("config.promptTemplate")) {
    // We get the potentially relevant instances
    // Note we assume T('id') is unique in the thread (may not be true)
    const instanceIds = await threadsStore_async.get(T("threadId"));
    for (const instanceId of instanceIds) {
      const tmp = await instancesStore_async.get(instanceId);
      threadTasks[tmp.id] = tmp;
    }
  }

  if (T("config.promptTemplate")) {
    response += T("config.promptTemplate").reduce(function (acc, curr) {
      // Currently this assumes the parts are from the same taskflow, could extend this
      const regex = /(^.+)\.(.+$)/;
      const matches = regex.exec(curr);
      if (matches) {
        // console.log("matches task " + matches[1] + " " + matches[2])
        if (threadTasks[parentId + "." + matches[1]] === undefined) {
          console.log(
            "threadTasks " + parentId + "." + matches[1] + " does not exist"
          );
        }
        if (
          threadTasks[parentId + "." + matches[1]]["output"][matches[2]] ===
          undefined
        ) {
          console.log(
            "threadTasks " +
              parentId +
              "." +
              matches[1] +
              ".output." +
              matches[2] +
              " does not exist"
          );
        }
        // Will crash NodeJS Task Processor if not present
        return (
          acc + threadTasks[parentId + "." + matches[1]]["output"][matches[2]]
        );
      } else {
        return acc + curr;
      }
    });
    console.log("Assembled response " + prompt);
  } else if (T("config.response")) {
    // Should not pass here if this is an error
    response = T("config.response");
  }
  // Ensure we do not overwrite the deltaState on the Browser Task Processor
  T("state.deltaState", undefined); // Should be centralized?
  T("response.text", response);
  T("updatedAt", Date.now()); // Should be centralized?
  console.log("Returning from TaskShowResponse");
  return task;
};

export { TaskShowResponse_async };
