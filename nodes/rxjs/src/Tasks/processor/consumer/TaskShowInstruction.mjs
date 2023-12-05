/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { initiateFsm, updateStates, updateEvent_async } from "#src/taskFSM";
import { commandUpdate_async } from "#src/commandUpdate";
import { utils } from "#src/utils";
import { instancesStore_async, dataStore_async } from "#src/storage";

/*



*/

const TaskShowInstruction_async = async function (wsSendTask, T, FSMHolder) {

  utils.logTask(T(), "TaskShowInstruction_async", utils.js(T("node.commandArgs")));

  // Don't ignore sync operations as this is how we can receive events
  // We can't accept all syncs as it will restart the FSM each time
  if ( T("node.commandArgs.sync") ) {
    let processSync;
    if ( T("node.commandArgs.fsmEvent") ) {
      utils.logTask(T(), "TaskShowInstruction_async allow sync");
      processSync = true;
    }
    if (!processSync) return null; // Ignore sync operations
  }

  const operatorLLM = T("operators")?.["LLM"]?.module;

  // eslint-disable-next-line no-unused-vars
  async function LLMSectionReview(questionnaire, filteredQuestionnaire, prevInterviewStep, currInterviewStep, nextInterviewStep) {
    const prevInstanceId = T("shared.stepper.prevInstanceId");
    const prevTask = await instancesStore_async.get(prevInstanceId);
    // TaskConversation is not loggin updates to the output - maybe it should upon exiting?
    const msgs = prevTask?.output?.msgsHistory;
    utils.logTask(T(), "prevInstanceId:", prevInstanceId, "msgs:", utils.js(msgs));
    let fullConversation = await dataStore_async.get(T("familyId") + "fullConversation") || [];
    let prevConversation = '';
    if (msgs) {
      for (const msg of msgs) {
        if (msg.role === 'user') {
          prevConversation += T("user.label") + ": " + msg.content;
        } 
        if (msg.role === 'assistant') {
          prevConversation += T("config.family.assistantName") + ": " + msg.content;
        }
      }
      fullConversation.push(...msgs);
    }
    dataStore_async.set(T("familyId") + "fullConversation", fullConversation);
    const nextSection = questionnaire[nextInterviewStep].intentions.join(' ');
    // We also need to process the responses and fill the questionnaire.
    // Use the JSON features - select the right service for this

    // Need to configure LLM to use different service (json)
    // But still we need a copy of task to allow for parallel requests
    const taskCopy = utils.deepClone(T());
    let TC = utils.createTaskValueGetter(taskCopy);
    const operatorJSON = TC("operators")["LLM"].module;
    TC("operators.LLM.chatServiceName", "json");
    delete questionnaire.order;
    let prompt = T("config.local.promptQuestionnaireReview");
    prompt = prompt.replace('%PREV_CONVERSATION%', prevConversation);
    TC("request.prompt", prompt);
    // We should disable the streaming so it does not interfere with the next requset
    TC("request.stream", false);
    operatorJSON.operate_async(wsSendTask, TC())
      .then((jsonOut) => {
        utils.logTask(TC(), "jsonOut", jsonOut.response.LLM);
        let changes;
        let syncTask = {};
        try {
          changes = JSON.parse(jsonOut.response.LLM);
        } catch (e) {
          utils.logTask(TC(), "Error parsing jsonOut.response.LLM", e);
        }
        if (changes &&  typeof changes === 'object') {
          utils.logTask(TC(), "LLMSectionReview have changes");
          // Only modify sections in the original questionnaire
          let newAnswers;
          for (const key in changes) {
            if (key in TC("shared.family.questionnaire")) {
              // We expect each question to have a key
              const changeSection = changes[key];
              for (const qkey in changeSection["questions"]) {
                utils.logTask(TC(), `LLMSectionReview ${key} ${qkey}`);
                const qPath = "shared.family.questionnaire" + "." + key + ".questions." + qkey;
                const origQuestion = TC(qPath)
                if (changes[key]["questions"][qkey]["answer"] && origQuestion) {
                  const oldAnswer = TC(qPath + ".answer");
                  utils.logTask(TC(), `LLMSectionReview Old answer before update: ${oldAnswer}`);
                  TC(qPath + ".answer", changes[key]["questions"][qkey]["answer"]);
                  utils.logTask(TC(), `LLMSectionReview Updated questionnaire ${key} ${qkey} Old answer: ${oldAnswer} New answer: ${changes[key]["questions"][qkey]["answer"]}`);
                  newAnswers = true;
                }
              }
            }
          }
          if (newAnswers) {
            syncTask = {
              shared:{
                family: {
                  questionnaire: TC("shared.family.questionnaire")
                },
              },
            };
          }
        }
        TC("commandDescription", "LLMSectionReview review updated questionnaire");
        TC("commandArgs", {
          fsmEvent: 'GOTOfilled',
          instanceId: TC("instanceId"), 
          sync: true, 
          syncTask,
        });
        commandUpdate_async(wsSendTask, TC()).then(() => {
          utils.logTask(TC(), `Setting shared.family.questionnaire`);
        });
        // Here we need to update the questionnaire
      });
    let prevReview = await dataStore_async.get(T("familyId") + "prevReview") || '';
    if (prevReview) {
      prevReview = `The previous review is presented between following <BEGIN> and <END> tag:\n<BEGIN>${prevReview}<END>\n.`;
    }
    // config.local.promptQuestionnaireReview
    prompt = T("config.local.promptQuestionnaireReview");
    prompt = prompt.replace('%PREV_INTERVIEW_STEP%', prevInterviewStep);
    prompt = prompt.replace('%PREV_CONVERSATION%', prevConversation);
    prompt = prompt.replace('%FILTERED_QUESTIONNAIRE%', utils.js(filteredQuestionnaire));
    prompt = prompt.replace('%PREV_REVIEW%', prevReview);
    prompt = prompt.replace('%NEXT_SECTION%', nextSection);
    T("request.prompt", prompt);
    const chatOut = await operatorLLM.operate_async(wsSendTask, T());
    dataStore_async.set(T("familyId") + "prevReview", chatOut.response.LLM);
    // Store the output of the previous review step using familyId
    // It is important to sync otherwise we risk to revert the state with an update
    T("commandDescription", "LLMSectionReview setting output.instruction");
    T("commandArgs", {
      instanceId: T("instanceId"), 
      sync: true, 
      syncTask: {
        output:{
          instruction: chatOut.response.LLM,
        },
      },
    });
    commandUpdate_async(wsSendTask, T()).then(() => {
      utils.logTask(T(), `Setting output.instruction`);
    });
    utils.logTask(T(), "Done LLMSectionReview");
    // Because this is async we need to send FSM event by update
    //updateEvent_async(wsSendTask, T, 'GOTOdisplayInstruction');
  }
  
  // eslint-disable-next-line no-unused-vars
  async function LLMIntroduction(questionnaire, filteredQuestionnaire, prevInterviewStep, currInterviewStep, nextInterviewStep) {
    utils.logTask(T(), "LLMIntroduction filteredQuestionnaire", utils.js(filteredQuestionnaire));
    // config.local.promptIntroduction
    let prompt = T("config.local.promptIntroduction");
    prompt = prompt.replace('%FILTERED_QUESTIONNAIRE%', utils.js(filteredQuestionnaire));
    T("request.prompt", prompt);
    const operatorOut = await operatorLLM.operate_async(wsSendTask, T());
    dataStore_async.set(T("familyId") + "prevReview", operatorOut.response.LLM);
    // Sync the final response
    T("commandDescription", "LLMIntroduction");
    T("commandArgs", {
      instanceId: T("instanceId"), 
      sync: true, 
      syncTask: {
        output:{
          instruction: operatorOut.response.LLM
        }
      },
    });
    commandUpdate_async(wsSendTask, T()).then(() => {
      utils.logTask(T(), `Setting output.instruction`);
    });
    utils.logTask(T(), "Done LLMIntroduction");
    // Because this is async we need to send FSM event by update
    updateEvent_async(wsSendTask, T, 'GOTOfilled');
  }

  // eslint-disable-next-line no-unused-vars
  async function LLMConclusion(questionnaire, filteredQuestionnaire, prevInterviewStep, currInterviewStep, nextInterviewStep) {
    // config.local.promptConclusion
    let prompt = T("config.local.promptConclusion");
    T("request.prompt", prompt);
    const operatorOut = await operatorLLM.operate_async(wsSendTask, T());
    dataStore_async.set(T("familyId") + "prevReview", operatorOut.response.LLM);
    // Sync the final response
    T("commandDescription", "LLMConclusion");
    T("commandArgs", {
      instanceId: T("instanceId"), 
      sync: true, 
      syncTask: {
        output:{
          instruction: operatorOut.response.LLM
        }
      },
    });
    commandUpdate_async(wsSendTask, T()).then(() => {
      utils.logTask(T(), `Setting output.instruction`);
    });
    utils.logTask(T(), "Done LLMConclusion");
    // Because this is async we need to send FSM event by update
    updateEvent_async(wsSendTask, T, 'GOTOfilled');
  }

  function filterAnsweredQuestions(questionnaire) {
    return Object.keys(questionnaire).reduce((filteredQuestions, section) => {
      if (section === "order") {
        //utils.logTask(T(), `filterAnsweredQuestions deleting order`);
        delete filteredQuestions[section];
        return filteredQuestions;
      }
      //utils.logTask(T(), `filterAnsweredQuestions section ${section}`);
      filteredQuestions[section] = {};
      filteredQuestions[section]["questions"] = Object.entries(questionnaire[section]["questions"])
        .reduce((sectionQuestions, [key, value]) => {
          if (value.answer) {
              sectionQuestions[key] = value;
          }
          return sectionQuestions;
        }, {});
      // Remove empty sections
      if (Object.keys(filteredQuestions[section]["questions"]).length === 0) {
        //utils.logTask(T(), `filterAnsweredQuestions deleting section ${section}`);
        delete filteredQuestions[section];
      }
      return filteredQuestions;
    }, {});
  }

  // actions are intended to be "fire and forget"
  const actions = {
    rxjs_processor_consumer_start: () => {
      T("output.instruction", T("config.local.instruction"));
      FSMHolder.send('GOTOdisplayInstruction');
    },
    rxjs_processor_consumer_fill: () => {
      if (T("shared.family.questionnaire")) {
        // eslint-disable-next-line no-unused-vars
        const questionnaire = utils.deepClone(T("shared.family.questionnaire"));
        const filteredQuestionnaire = filterAnsweredQuestions(questionnaire);
        const interviewPhase = T("config.local.interviewPhase");
        const order = questionnaire.order;
        const stepperCount = T("shared.stepper.count");
        // Check if the next entry in order is "Conclusion"
        let conclude;
        if (stepperCount && order[stepperCount + 1] === "Conclusion") {
          conclude = true;
        }
        let prevInterviewStep;
        if (stepperCount > 0) {
          prevInterviewStep = order[stepperCount - 1];
        }
        const currInterviewStep = order[stepperCount];
        let nextInterviewStep;
        if (stepperCount < order.length - 1) {
          nextInterviewStep = order[stepperCount + 1];
        }
        utils.logTask(T(), "rxjs_processor_consumer_fill interviewPhase", interviewPhase, "order", order, "stepperCount", stepperCount, "conclude", conclude, "prevInterviewStep", prevInterviewStep, "currInterviewStep", currInterviewStep, "nextInterviewStep", nextInterviewStep);
        switch (interviewPhase) {
          case "introduction":
            LLMIntroduction(questionnaire, filteredQuestionnaire, prevInterviewStep, currInterviewStep, nextInterviewStep);
            break;
          case "review":
            LLMSectionReview(questionnaire, filteredQuestionnaire, prevInterviewStep, currInterviewStep, nextInterviewStep);
            if (conclude) {
              const nextTask = T("config.nextTask");
              const parts = nextTask.split('.');
              parts[parts.length - 1] = "conclusion";
              const modifiedInterviewStep = parts.join('.');
              T("config.nextTask", modifiedInterviewStep);
            }
            break;
          case "conclusion":
            LLMConclusion(questionnaire, filteredQuestionnaire, prevInterviewStep, currInterviewStep, nextInterviewStep);
            break;
          default:
            throw new Error(`Unknown interviewPhase ${interviewPhase}`);
        }
        FSMHolder.send('GOTOdisplayInstruction');
      } else {
        throw new Error("No questionnaire");
      }
    }
  };

  const guards = {};
  const singleStep = true; // So we can wait in waitingForFill until GOTOfilled

  // If the FSM is not sngelStep we should sync the state changes ?

  initiateFsm(T, FSMHolder, actions, guards, singleStep);

  // Transfer state of fsm to task.state
  updateStates(T, FSMHolder);

  // To wait on an action we could do it here, better to use a dedicated state + updateEvent_async

  // This task can be used as an errorTask so an error here risks to create a loop
  // There is an errorRate limit on the Hub to catch this (but it will crash the Hub)

  return T();
};

export { TaskShowInstruction_async };
