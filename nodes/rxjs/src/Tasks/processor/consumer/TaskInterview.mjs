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

// eslint-disable-next-line no-unused-vars
const TaskInterview_async = async function (wsSendTask, T, FSMHolder) {

    if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

    const riDir = path.join(NODE.storage.dataDir, "RI");
    const userDir = path.join(riDir, "users", T("user.id"));
    const questionnaireFileName = "questionnaire.mjs";

    switch (T("state.current")) {
      case "start": {
        const questionnairePath = path.join(userDir, questionnaireFileName);
        console.log("TaskInterview_async", userDir);
        if (!fs.existsSync(questionnairePath)) {
          console.log("Questionnaire does not exist");
          if (!fs.existsSync(userDir)) {
            console.log("Creating directory: " + userDir);
            fs.mkdirSync(userDir, { recursive: true }, (err) => {
              if (err) throw err;
            });
          }
          const questionnaireTemplatePath = path.join(riDir, questionnaireFileName);
          fs.copyFileSync(questionnaireTemplatePath, questionnairePath);
        }
        const module = await import(questionnairePath);
        const questionnaire = module.questionnaire;
        //console.log("questionnaire", utils.js(module));
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
              console.log("Found CEP");
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
          //const userProfile = {}; // Need to load this
          // A task could update the userProfile e.g. after each Task completes
          // How to know when task completed ? The stepper could set something and we connect to that
          //   e.g. output.taskId
          // Can the templating use shard or does it need to use outputs ? (which seems possible)
          // Of we sort by ID then it should be very easy to find nearest parent/nearest child by name
          //T("shared.family.userProfile", userProfile); // An alternative to this is to use the CEP but not dynamic enough family is better
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
        console.log("WARNING unknown state : " + T("state.current"));
        return null;
    }
  
    return null;
  };
  
  export { TaskInterview_async };
  