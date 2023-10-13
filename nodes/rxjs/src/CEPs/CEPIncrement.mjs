  /*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { commandUpdate_async } from "#src/commandUpdate";

// A demo
// Because we are modifying the same task instance we do not use the commandUpdate_async
// We cannot modify the task after coprocessing because those changes will not be dispatched
async function cep_async(wsSendTask, CEPInstanceId, task, args) {
  const increment = args.increment;
  // We cannot send an update to a command tha has not already been stored as active
  // Otherwise the diff communication will fail.
  if (task.node.command === "start" || task.node.command === "init") {
    utils.logTask(task, "CEPIncrement doing nothing for start and init command")
    return;
  }
  if (task.node.commandArgs.sync) {
    utils.logTask(task, "CEPIncrement doing nothing for sync")
    return;
  }
  if (task.output.CEPCount > 100) {
    utils.logTask(task, "CEPIncrement stopped with CEPCount " + task.output.CEPCount);
    return
  }
  let syncUpdateTask = {
    command: "update",
    commandArgs: {
      sync: true,
      instanceId: task.instanceId,
      syncTask: {
        output: {
          CEPCount: task.output.CEPCount ? task.output.CEPCount + increment : increment,
          modifiedBy: CEPInstanceId,
        },
      },
      messageId: task.messageId,
    },
    commandDescription: "Incrementing output.CEPCount by " + increment,
  };
  await commandUpdate_async(wsSendTask, syncUpdateTask);

  //let syncDiff = {}
  //syncDiff["output"] = {};
  //syncDiff.output["CEPCount"] = task.output.CEPCount ? task.output.CEPCount + increment : increment;
  //syncDiff.output["CEPinitiatingNodeId"] = task.node.initiatingNodeId;
  utils.logTask(task, "CEPCount", task.output.CEPCount, increment);
  utils.logTask(task, "CEPIncrement called on " + task.id + " CEP created by " + CEPInstanceId);
  // We can do this if running on coprocessor
  //task.output["modifiedBy"] = CEPInstanceId;
  //task.output["CEPCount"] = syncDiff.output["CEPCount"];
  return task;
}

export const CEPIncrement = {
  cep_async,
} 