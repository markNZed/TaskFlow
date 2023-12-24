/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// eslint-disable-next-line no-unused-vars
import fs from 'fs';
import path from 'path';
import { NODE } from "#root/config";
import { commandStart_async } from "#src/commandStart";
import { utils } from "#src/utils";
import { commandUpdate_async } from "#src/commandUpdate";
//import { dataStore_async } from "#src/storage";

/*

At the start of the process we could allow the user to upload any relevant documents e.g. CV

*/

// eslint-disable-next-line no-unused-vars
const TaskInterview_async = async function (wsSendTask, T, FSMHolder) {

    // Save changes to shared.family.questionnaire to disk
    const riDir = path.join(NODE.storage.dataDir, "RI");
    const userDir = path.join(riDir, "users", T("user.id"));
    const questionnaireFileName = "questionnaire.mjs";
    const questionnairePath = path.join(userDir, questionnaireFileName);

    if (utils.checkSyncEvents(T(), "shared.family.questionnaire")) {
      //utils.logTask(T(), `TaskInterview_async found shared.family.questionnaire`);
      const modPath = path.join(userDir, "questionnaire.mjs");
      const dataString = "export const questionnaire = " + utils.js(T("shared.family.questionnaire"));
      fs.writeFile(modPath, dataString, 'utf8', (err) => {
        if (err) {
          console.error(err);
        }
        utils.logTask(T(), `TaskInterview_async file ${modPath} has been written`);
      });
    }

    if (utils.checkSyncEvents(T(), "input.msgs") && T("input.msgs")) {
      const lastMsgs = T("state.lastMsgs");
      let conversation = [];
      let update = false;
      utils.logTask(T(), `TaskInterview_async lastMsgs: ${utils.js(lastMsgs)}`);
      if (lastMsgs) {
        if (typeof T("input.msgs") === 'string') {
          if (!utils.deepEqual(T("input.msgs"), lastMsgs[0])) {
            utils.logTask(T(), `TaskInterview_async adding msg string to conversation ${T("input.msgs")}`);
            conversation = [T("input.msgs")];
            update = true;
          }
        } else {
          for (let index = 0; index < T("input.msgs").length; index++) {
            const msg = T("input.msgs")[index];
            if (!utils.deepEqual(msg, lastMsgs[index])) {
              conversation.push(msg);
              //utils.logTask(T(), `TaskInterview_async adding msg to conversation index: ${index} lastMsgs: ${utils.js(lastMsgs[index])}, msg: ${utils.js(msg)}`);
              update = true;
            }
          }
        }
      } else {
        utils.logTask(T(), "TaskInterview_async adding input.msgs to conversation", utils.js(T("input.msgs")));
        if (typeof T("input.msgs") === 'string') {
          conversation = [T("input.msgs")];
        } else {
          conversation = T("input.msgs");
        }
        update = true;
      }
      if (update) {
        // Here we modify command and it will also be picked up in nodeTasks
        // So create a new Task to pass to commandUpdate_async
        const msgsClone = utils.deepClone(T("input.msgs"));
        let newLastMsgs;
        if (typeof T("input.msgs") === 'string') {
          newLastMsgs = [msgsClone]
        } else {
          newLastMsgs = msgsClone;
        }
        let updateTask = {
          command: "update",
          commandDescription: `Updating lastMsgs`,
          commandArgs: {
            instanceId: T("instanceId"), 
            sync: true, 
            syncTask: {
              state: {
                lastMsgs: newLastMsgs,
              },
            },
          }
        };
        commandUpdate_async(wsSendTask, updateTask).then(() => {
          utils.logTask(T(), `Setting newLastMsgs`, utils.js(newLastMsgs));
        });
        const modPath = path.join(userDir, "fullConversation.mjs");
        fs.appendFile(modPath, utils.js(conversation), 'utf8', (err) => {
          if (err) {
            console.error(err);
          }
          utils.logTask(T(), `TaskInterview_async file ${modPath} has been appended`);
        });
      }
    }

    if (T("node.commandArgs.sync")) {
      utils.logTask(T(), "TaskInterview_async node.commandArgs", utils.js(T("node.commandArgs")));
      return null
    } // Ignore other sync operations

    switch (T("state.current")) {
      case "start": {
        utils.logTask(T(), "TaskInterview_async", userDir);
        if (!fs.existsSync(questionnairePath)) {
          utils.logTask(T(), "Questionnaire does not exist");
          if (!fs.existsSync(userDir)) {
            utils.logTask(T(), "Creating directory: " + userDir);
            fs.mkdirSync(userDir, { recursive: true }, (err) => {
              if (err) throw err;
            });
          }
          const questionnaireTemplatePath = path.join(riDir, questionnaireFileName);
          fs.copyFileSync(questionnaireTemplatePath, questionnairePath);
        }
        const module = await import(questionnairePath);
        const questionnaire = module.questionnaire;
        //utils.logTask(T(), "questionnaire", utils.js(module));
        T("shared.family.questionnaire", questionnaire);
        T("state.current", "spawn");
        T("command", "update");
        T("commandDescription", `Have set questionnaire`);
        break;
      }
      case "spawn": {
        // Spawn children
        const childrenId = T("meta.childrenId");
        if (childrenId && childrenId.length) {
          for (const childId of childrenId) {
            // We should rework the API for commandStart_async
            let startTask = utils.deepClone(T());
            startTask = utils.deepMerge(startTask, {
              command: "start",
              commandArgs: {
                init: {
                  id: childId,
                },
              },
              commandDescription: `Spawning of ${childId}`,
            });
            /*
            if (childId.endsWith(".cep")) {
              utils.logTask(T(), "Found CEP");
              startTask = utils.deepMerge(startTask, {
                commandArgs: {
                  init : {
                    ceps : {
                      taskConfig: {
                        args: {
                          overrideConfigs: "something to do",
                        }
                      }
                    }
                  }
                }
              });
            }
            */
            await commandStart_async(wsSendTask, startTask);
          }
          T("state.current", "spawned");
          T("command", "update");
          T("commandDescription", `Have spawned ${childrenId.length} children`);
        }
        break;
      }
      case "spawned": {
        break;
      }
      default:
        utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
        return null;
    }
  
    return T();
  };
  
  export { TaskInterview_async };
  