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
import { dataStore_async } from "#src/storage";

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
      const modPath = path.join(userDir, "questionnaireMod.mjs");
      const dataString = "export const questionnaire = " + utils.js(T("shared.family.questionnaire"));
      fs.writeFile(modPath, dataString, 'utf8', (err) => {
        if (err) {
          console.error(err);
        }
        utils.logTask(T(), `TaskInterview_async file ${modPath} has been written`);
      });
    }

    // This is a hack to set shared.family.interviewStep so it can be used in TaskChat template
    // If we had a templating language with operations we could do this in the template
    if (utils.checkSyncEvents(T(), "shared.stepper.count")) {
      const stepperCount = T("shared.stepper.count")
      const questionnaireOffset = T("config.family.questionnaireOffset") || 0;
      let questionnaireIdx = Math.ceil((stepperCount - questionnaireOffset) / 2) - 1;
      if (questionnaireIdx < 0) questionnaireIdx = 0;
      utils.logTask(T(), `questionnaireIdx ${questionnaireIdx}`);
      const modPath = path.join(userDir, "fullConversation.mjs");
      const fullConversation = await dataStore_async.get(T("familyId") + "fullConversation");
      if (fullConversation) {
        fs.appendFile(modPath, utils.js(fullConversation), 'utf8', (err) => {
          if (err) {
            console.error(err);
          }
          utils.logTask(T(), `TaskInterview_async file ${modPath} has been appended`);
        });
      }
      const questionnaire = T("shared.family.questionnaire");
      if (!questionnaire) return;
      const order = T("shared.family.questionnaire")["order"]
      if (!order) return;
      const interviewStep = T("shared.family.questionnaire")["order"][questionnaireIdx]
      const interviewStepDuration = T("shared.family.questionnaire")[interviewStep]["interviewStepDuration"]
      if (interviewStep && interviewStep !== T("shared.family.interviewStep")) {
        T("commandDescription", "Updating the interviewStep");
        T("commandArgs", {
          instanceId: T("instanceId"), 
          sync: true, 
          syncTask: {
            shared: {
              family: {
                interviewStep,
                interviewStepDuration
              }
            }
          },
        });
        commandUpdate_async(wsSendTask, T()).then(() => {
          utils.logTask(T(), `Setting shared.family.interviewStep`);
        });
      }
    }

    if (T("node.commandArgs.sync")) {
      utils.logTask(T(), "TaskInterview_async node.commandArgs", utils.js(T("node.commandArgs")));
      return null
    } // Ignore sync operations

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
        utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
        return null;
    }
  
    return null;
  };
  
  export { TaskInterview_async };
  