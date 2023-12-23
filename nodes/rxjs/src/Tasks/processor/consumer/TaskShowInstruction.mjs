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
  async function LLMSectionReview(questionnaire, filteredQuestionnaire, prevInterviewStep, nextInterviewStep) {
    const prevInstanceId = T("shared.stepper.prevInstanceId");
    if (!prevInstanceId) {
      throw new Error("No prevInstanceId");
    }
    const prevTask = await instancesStore_async.get(prevInstanceId);
    if (!prevInstanceId) {
      throw new Error("No prevTask " + prevInstanceId);
    }
    // TaskConversation is not logging updates to the output - maybe it should upon exiting?
    const msgs = prevTask?.output?.msgsHistory;
    utils.logTask(T(), "prevInstanceId:", prevInstanceId, "msgs:", utils.js(msgs));
    let prevConversation = '';
    if (msgs) {
      for (const msg of msgs) {
        if (msg.role === 'user') {
          prevConversation += T("user.label") + ": " + msg.content + " ";
        } 
        if (msg.role === 'assistant') {
          prevConversation += T("config.family.assistantName") + ": " + msg.content + " ";
        }
      }
    }
    // We also need to process the responses and fill the questionnaire.
    // Use the JSON features - select the right service for this

    // Need to configure LLM to use different service (json)
    // But still we need a copy of task to allow for parallel requests
    const taskCopy = utils.deepClone(T());
    let TC = utils.createTaskValueGetter(taskCopy);
    const operatorJSON = TC("operators")["LLM"].module;
    TC("operators.LLM.chatServiceName", "json");
    delete questionnaire.order;
    // A simpler questionnaire structure to make JSON generation easier
    let simpleQuestionnaire = {};
    for (const section in questionnaire) {
      simpleQuestionnaire[section] = {};
      for (const question in questionnaire[section]['questions']) {
        simpleQuestionnaire[section][question] = questionnaire[section]['questions'][question];
      }
    }
    let prompt = TC("config.local.promptQuestionnaireUpdate") || '';
    prompt = prompt.replace('%PREV_CONVERSATION%', prevConversation);
    prompt = prompt.replace('%QUESTIONNAIRE%', JSON.stringify(simpleQuestionnaire));
    TC("request.prompt", prompt);
    // We should disable the streaming so it does not interfere with the next requset
    TC("request.stream", false);
    operatorJSON.operate_async(wsSendTask, TC())
      .then((jsonOut) => {
        utils.logTask(TC(), "jsonOut", jsonOut.response.LLM);
        let changes;
        try {
          changes = JSON.parse(jsonOut.response.LLM);
        } catch (e) {
          utils.logTask(TC(), "Error parsing jsonOut.response.LLM", e);
        }
        let newAnswers;
        if (changes &&  typeof changes === 'object') {
          utils.logTask(TC(), "LLMSectionReview have changes");
          // Only modify sections in the original questionnaire
          for (const changeSection in changes) {
            if (changeSection in TC("shared.family.questionnaire")) {
              // We expect each question to have a key
              utils.logTask(TC(), `LLMSectionReview change to section ${changeSection}`);
              for (const qkey in changes[changeSection]) {
                const qPath = "shared.family.questionnaire" + "." + changeSection + ".questions." + qkey;
                const origQuestion = TC(qPath);
                if (changes[changeSection][qkey]["answer"] && origQuestion) {
                  const oldAnswer = TC(qPath + ".answer");
                  const newAnswer = changes[changeSection][qkey]["answer"];
                  if (oldAnswer !== newAnswer) {
                    utils.logTask(TC(), `LLMSectionReview Old answer before update: ${oldAnswer}`);
                    TC(qPath + ".answer", changes[changeSection][qkey]["answer"]);
                    utils.logTask(TC(), `LLMSectionReview Updated questionnaire ${changeSection} ${qkey} Old answer: ${oldAnswer} New answer: ${changes[changeSection][qkey]["answer"]}`);
                    newAnswers = true;
                  }
                }
              }
            }
          }
        }
        TC("commandDescription", "LLMSectionReview review updated questionnaire");
        TC("commandArgs", {
          fsmEvent: 'GOTOfilled',
          instanceId: TC("instanceId"), 
          sync: true, 
        });
        // Only send syncTask is we have new answers
        if (newAnswers) {
          const syncTask = {
            shared: {
              family: {
                questionnaire: TC("shared.family.questionnaire"),
              }
            },
          };
          TC("commandArgs.syncTask", syncTask);
        }
        commandUpdate_async(wsSendTask, TC()).then(() => {
          utils.logTask(TC(), `Setting shared.family.questionnaire`);
        });
        // Here we need to update the questionnaire
      });
    let prevReview = await dataStore_async.get(T("familyId") + "prevReview") || '';
    if (prevReview) {
      prevReview = `The previous review is presented between following <BEGIN> and <END> tag:\n<BEGIN>${prevReview}<END>\n.`;
    }
    const nextSectionIntentions = questionnaire[nextInterviewStep].intentions.join(' ');
    prompt = T("config.local.promptQuestionnaireReview");
    prompt = prompt.replace('%PREV_INTERVIEW_STEP%', prevInterviewStep);
    prompt = prompt.replace('%PREV_CONVERSATION%', prevConversation);
    prompt = prompt.replace('%FILTERED_QUESTIONNAIRE%', utils.js(filteredQuestionnaire));
    prompt = prompt.replace('%PREV_REVIEW%', prevReview);
    prompt = prompt.replace('%NEXT_SECTION%', nextInterviewStep);
    prompt = prompt.replace('%NEXT_SECTION_INTENTIONS%', nextSectionIntentions);
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
        shared: {
          family: {
            interviewStep: T("shared.family.interviewStep"),
            interviewStepDuration: T("shared.family.interviewStepDuration"),
          },
        },
      },
    });
    /*
    if (nextInterviewStep === "Conclusion") {
      utils.logTask(T(), `Forcing nextTask to conclusion`);
      T("commandArgs.syncTask.config.nextTask", "conclusion");
    }
    */
    commandUpdate_async(wsSendTask, T()).then(() => {
      utils.logTask(T(), `Setting output.instruction`);
    });
    utils.logTask(T(), "Done LLMSectionReview");
    // Because this is async we need to send FSM event by update
    //updateEvent_async(wsSendTask, T, 'GOTOdisplayInstruction');
  }
  
  // eslint-disable-next-line no-unused-vars
  async function LLMQuestionnaireSummary(questionnaire, filteredQuestionnaire) {
    utils.logTask(T(), "LLMQuestionnaireSummary filteredQuestionnaire", utils.js(filteredQuestionnaire));
    let prompt = T("config.local.promptQuestionnaireSummary") || '';
    prompt = prompt.replace('%FILTERED_QUESTIONNAIRE%', utils.js(filteredQuestionnaire));
    T("request.prompt", prompt);
    const operatorOut = await operatorLLM.operate_async(wsSendTask, T());
    dataStore_async.set(T("familyId") + "prevReview", operatorOut.response.LLM);
    // Sync the final response
    T("commandDescription", "LLMQuestionnaireSummary");
    T("commandArgs", {
      instanceId: T("instanceId"), 
      sync: true, 
      syncTask: {
        output:{
          instruction: operatorOut.response.LLM
        },
        shared: {
          family: {
            interviewStep: T("shared.family.interviewStep"),
            interviewStepDuration: T("shared.family.interviewStepDuration"),
          },
        },
      },
    });
    commandUpdate_async(wsSendTask, T()).then(() => {
      utils.logTask(T(), `Setting output.instruction`);
    });
    utils.logTask(T(), "Done LLMQuestionnaireSummary");
    // Because this is async we need to send FSM event by update
    updateEvent_async(wsSendTask, T, 'GOTOfilled');
  }

  // eslint-disable-next-line no-unused-vars
  async function LLMConclusion(questionnaire, filteredQuestionnaire) {
    utils.logTask(T(), "LLMConclusion");
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
        },
        config: {
          nextTask: "stop",
        },
        shared: {
          family: {
            interviewStep: T("shared.family.interviewStep"),
            interviewStepDuration: T("shared.family.interviewStepDuration"),
          },
        },
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

  function sectionAnswered(questionnaire, section) {
    let result = true;
    for (const qkey in questionnaire[section]["questions"]) {
      if (!questionnaire[section]["questions"][qkey].answer) {
        result = false;
        break;
      }
    }
    return result;
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
        const order = questionnaire.order;
        const stepperCount = T("shared.stepper.count");
        let prevInterviewStep;
        let nextInterviewStep;
        let currInterviewStep;
        let questionnaireIdx;
        if (T("config.local.interviewStep")) {
          currInterviewStep = T("config.local.interviewStep");
          nextInterviewStep = T("config.local.nextInterviewStep");
          prevInterviewStep = T("config.local.prevInterviewStep");
          if (order.includes(nextInterviewStep)) {
            questionnaireIdx = order.indexOf(nextInterviewStep);
          } else {
            questionnaireIdx = 0;
          }
        } else {
          const lastInterviewStep = T("shared.family.interviewStep");
          if (order.includes(lastInterviewStep)) {
            questionnaireIdx = order.indexOf(lastInterviewStep) + 1;
          } else {
            questionnaireIdx = 0;
          }
          if (questionnaireIdx > 0) {
            prevInterviewStep = order[questionnaireIdx - 1];
          }
        }
        // Skip sections with all questions answered
        // eslint-disable-next-line no-constant-condition
        while (true) {
          nextInterviewStep = order[questionnaireIdx];
          if (!sectionAnswered(questionnaire, nextInterviewStep)) {
            utils.logTask(T(), `rxjs_processor_consumer_fill !sectionAnswered ${nextInterviewStep}`);
            break;
          }
          if (nextInterviewStep === "Conclusion") {
            currInterviewStep = "Conclusion";
            break;
          }
          questionnaireIdx += 1;
        }
        T("shared.family.interviewStep", nextInterviewStep);
        let interviewStepDuration = questionnaire[nextInterviewStep]["interviewStepDuration"];
        if (!interviewStepDuration && T("shared.family.interviewStepDuration")) {
          interviewStepDuration = T("shared.family.interviewStepDuration");
        }
        T("shared.family.interviewStepDuration", interviewStepDuration);
        // To have the changes to shared.family sent we add this to the syncTask in the functions called below
        // This avoids another update call but not ideal
        utils.logTask(T(), "rxjs_processor_consumer_fill stepperCount", stepperCount, "prevInterviewStep", prevInterviewStep, "nextInterviewStep", nextInterviewStep, "config.local.interviewStep", T("config.local.interviewStep"));
        switch (currInterviewStep) {
          // Include Introduction so config.local.interviewStep is set
          case "Introduction":
            T("output.instruction", T("config.local.instruction"));
            T("commandDescription", "Introduction setting shared.family.interviewStep and output.instruction");
            T("command", "update");
            FSMHolder.send('GOTOfilled');
            break;
          case "QuestionnaireSummary":
            LLMQuestionnaireSummary(questionnaire, filteredQuestionnaire);
            FSMHolder.send('GOTOdisplayInstruction');
            break;
          case "Conclusion":
            LLMConclusion(questionnaire, filteredQuestionnaire);
            //T("config.nextTask", "stop"); This did not work from here, I moved it into LLMConclusion where a sync update is made
            FSMHolder.send('GOTOdisplayInstruction');
            break;
          default:
            LLMSectionReview(questionnaire, filteredQuestionnaire, prevInterviewStep, nextInterviewStep);
            FSMHolder.send('GOTOdisplayInstruction');
            break;
        }
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
