/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { utils } from "#src/utils";
import { DUMMY_OPENAI } from "#root/config";
import * as dotenv from "dotenv";
dotenv.config(); // For process.env.OPENAI_API_KEY

// Should we return a promise? Better to be task iin/out ?

async function operate_async(wsSendTask, task) {
  const taskCopy = utils.deepClone(task);
  const T = utils.createTaskValueGetter(taskCopy);
  utils.logTask(T(), "Using LLM", T("operators.LLM"));
  const chatServiceName = T("operators.LLM.chatServiceName") || "chat"; 
  const service = T(`services.${chatServiceName}.module`);
  utils.logTask(T(), "Using service", service);
  let params = await chatPrepare_async(T, chatServiceName);
  params["wsSendTask"] = wsSendTask;
  params["T"] = T;
  const functionName = params.serviceConfig.API + "_async";
  const TIMEOUT_DURATION = 120000; // 90 seconds, adjust as needed
  let text, newMessages, errored;
  try {
    [text, newMessages, errored] = await Promise.race([
      callFunctionByName(service, functionName, params),
      new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OperatorLLM timed out after ' + TIMEOUT_DURATION + 'ms')), TIMEOUT_DURATION)
      )
    ]);
  } catch (e) {
    text = 'Timeout due to slow response from LLM, sorry.';
    newMessages = [];
    errored = true;
  }
  taskCopy["response"] = taskCopy.response || {}
  taskCopy.response.LLM = text;
  taskCopy.response.newMessages = newMessages;
  taskCopy.response.LLMerror = errored;
  return taskCopy;
}

function callFunctionByName(service, functionName, params) {
  //console.log("callFunctionByName service", service);
  const functions = {
    openaigpt_async: service.openaigpt_async,
    openaistub_async: service.openaistub_async,
  };
  const func = functions[functionName];
  if (typeof func === "function") {
    return func(params);
  } else {
    console.error(`No function named ${functionName} found in service`, service);
  }
}

function checkOperatorCache (T, operatorName) {
  // Loop over each object in T("operators") if it exists
  let enabled = false;
  let seed = T("id");
  if (T("operators")) {
    const operatorConfig = T("operators")[operatorName];
    if (operatorConfig) {
      if (operatorConfig.useCache !== undefined) {
        enabled = operatorConfig.useCache;
      }
      if (operatorConfig.seed !== undefined && operatorConfig.seed.length) {
        for (const cacheKeySeed of operatorConfig.seed) {
          if (cacheKeySeed.startsWith("task.")) {
            seed += T(cacheKeySeed.slice(5));
          } else {
            seed += cacheKeySeed;
          }
        }
      }
    }
  }
  return [enabled, seed];
}

// Prepare the parameters for the chat API request
// Nothing specific to a partiuclar chat API
// Also using serviceTypes
async function chatPrepare_async(T, chatServiceName) {

  const instanceId = T("instanceId");
  let systemMessage = "";
  let forget = false;
  let [useCache, cacheKeySeed] = checkOperatorCache(T, "LLM");
  utils.logTask(T(), "useCache config " + useCache + " seed " + cacheKeySeed);
  let noStreaming = false;

  //utils.logTask(T(), "prompt " + prompt);
  let serviceConfig = T("services." + chatServiceName);
  if (T("request.service")) {
    serviceConfig = utils.deepMerge(serviceConfig, T("request.service"));
  }
  const modelVersion = serviceConfig.modelVersion || serviceConfig.modelStrengthMap[serviceConfig.modelStrength];
  const temperature = serviceConfig.temperature;
  const maxTokens = serviceConfig.maxTokens;
  const maxResponseTokens = serviceConfig.maxResponseTokens;
  utils.logTask(T(), "maxResponseTokens " + maxResponseTokens + " maxTokens " + maxTokens  + " temperature " + temperature + " modelVersion " + modelVersion);
  let dummyAPI = serviceConfig.dummyAPI || DUMMY_OPENAI;
  utils.logTask(T(), "dummyAPI " + dummyAPI);

  //utils.logTask(T(), "Agent ", serviceConfig)

  let prompt;

  if (serviceConfig.prompt) {
    utils.logTask(T(), "Found prompt in serviceConfig.prompt");
    prompt = serviceConfig.prompt;
    //utils.logTask(T(), "Prompt " + prompt)
  } 

  if (T("request.prompt")) {
    utils.logTask(T(), "Found prompt in request.prompt");
    prompt = T("request.prompt");
    //utils.logTask(T(), "Request.prompt " + prompt)
  } 

  let functions;
  
  if (serviceConfig.functions) {
    utils.logTask(T(), "Found functions in serviceConfig.functions");
    functions = serviceConfig.functions;
  } 

  if (T("operators.LLM.promptWithTime")) {
    // Prefix prompt with date/time we use UTC to keep things simple
    // We need to be able to track user's timezone
    // Could be based on address
    const currentDate = new Date();
    const options = {
      timeZone: "UTC",
      timeZoneName: "short"
    };
    const formattedDate = currentDate.toLocaleString("en-US", options);
    prompt = "Time: " + formattedDate + "\n" + prompt;
    utils.logTask(T(), "oneFamily prompt : " + prompt);
  }

  if (serviceConfig.useCache !== undefined) {
    useCache = serviceConfig.useCache;
    utils.logTask(T(), "Task service config set cache " + useCache);
  }

  if (typeof serviceConfig?.prePrompt !== "undefined") {
    prompt = serviceConfig.prePrompt + prompt;
    utils.logTask(T(), "Prepend serviceConfig prompt " + serviceConfig.prePrompt);
  }

  if (typeof serviceConfig?.postPrompt !== "undefined") {
    prompt += serviceConfig.postPrompt;
    utils.logTask(T(), "Append serviceConfig prompt " + serviceConfig.postPrompt);
  }

  const environments = T("environments");
  // If the task is running on the rxjs-processor-consumer processor we do not use websocket
  if (environments.length === 1 && environments[0] === "rxjs-processor-consumer") {
    noStreaming = true;
    utils.logTask(T(), "Environment noStreaming");
  }

  if (serviceConfig.noStreaming !== undefined) {
    noStreaming = serviceConfig.noStreaming;
    utils.logTask(T(), "Request noStreaming", noStreaming);
  }

  if (serviceConfig.forget !== undefined) {
    forget = serviceConfig.forget
    utils.logTask(T(), "Task config forget previous messages", serviceConfig.forget);
  }

  let messages = [];

  if (serviceConfig?.messages) {
    messages.push(...serviceConfig.messages)
    utils.logTask(T(), 
      "Initial messages from serviceConfig " + serviceConfig.name
    );
    //utils.logTask(T(), "messages", messages);
  }

  if (serviceConfig.messages) {
    messages.push(...serviceConfig.messages)
    utils.logTask(T(), "Found config messages");
    //utils.logTask(T(), "messages", messages);
  }

  // This is assuming the structure used in TaskChat
  if (T("input.msgs") && !forget) {
    utils.logTask(T(), "Initializing messages from input.msgs");
    messages.push(...T("input.msgs"));
    //utils.logTask(T(), "messages", messages);
  }

  if (serviceConfig?.systemMessage) {
    systemMessage = serviceConfig.systemMessage;
    utils.logTask(T(), "Sytem message from serviceConfig " + serviceConfig.name);
  }

  // Replace MODEL variables in systemMessageTemplate
  if (serviceConfig.systemMessageTemplate) {
    const regex = /(MODEL)\.([^\s.]+)/g;
    // Using replace with a callback function
    systemMessage = serviceConfig.systemMessageTemplate.replace(regex, (match, p1, p2) => {
      if (!serviceConfig[p2]) {
        throw new Error(`serviceConfig ${p2} does not exist`);
      }
      return serviceConfig[p2];
    });
    utils.logTask(T(), "Sytem message from systemMessageTemplate " + T("id") + " " + systemMessage);
  }

  // We use newSystemMessageTemplate to override systemMessage when we want to include
  // MODEL.systemMessage in newSystemMessageTemplate
  if (serviceConfig.newSystemMessageTemplate) {
    const regex = /(MODEL)\.([^\s.]+)/g;
    // Find each instance of regex in the array of strings serviceConfig.newSystemMessageTemplate
    let matches = [];
    serviceConfig.newSystemMessageTemplate.forEach(template => {
      let match;
      regex.lastIndex = 0; // Reset regex state for each new string
      while ((match = regex.exec(template)) !== null) {
        matches.push(match[0]);
      }
    });
    utils.logTask(T(), "newSystemMessageTemplate matches", matches)
    let updatedMessage = serviceConfig.newSystemMessage;
    matches.forEach(match => {
      let secondMatch = match.match(regex);
      if (secondMatch && secondMatch[2]) {
        // Replace the match in the serviceConfig.newSystemMessage
        updatedMessage = updatedMessage.replace(match, secondMatch[2]);
        utils.logTask(T(), "newSystemMessage match", match, secondMatch[2])
      }
    });
    systemMessage = updatedMessage;
    utils.logTask(T(), "Sytem message from newSystemMessage " + T("id") + " " + systemMessage);
  }

  if (typeof serviceConfig?.preSystemMessage !== "undefined" && serviceConfig.preSystemMessage !== "") {
    systemMessage = serviceConfig.preSystemMessage + systemMessage;
    utils.logTask(T(), "Prepend preSystemMessage " + serviceConfig.preSystemMessage);
  }

  if (typeof serviceConfig?.postSystemMessage !== "undefined" && serviceConfig.postSystemMessage !== "") {
    systemMessage = systemMessage + serviceConfig.postSystemMessage;
    utils.logTask(T(), "Postpend postSystemMessage " + serviceConfig.postSystemMessage);
  }

  //utils.logTask(T(), "messages before map of id", messages);
  // The index starts at 1 so we do not have an id === 0 as this seemed to cause issues in ChatGPTAPI
  const prevMessages = messages.map((message, index) => ({
    ...message,
    parentMessageId: index === 0 ? null : (index),
    id: (index + 1)
  }));

  if (serviceConfig.cacheKeySeed) {
    cacheKeySeed = serviceConfig.cacheKeySeed;
  }

  // Check if we need to preprocess
  if (T("operators.LLM.regexProcessPrompt")) {
    for (const [regexStr, replacement] of T("operators.LLM.regexProcessPrompt")) {
      let { pattern, flags } = utils.parseRegexString(regexStr);
      let regex = new RegExp(pattern, flags);
      prompt = prompt.replace(regex, replacement);
      utils.logTask(T(), "regexProcessPrompt", regexStr, prompt);
    }
  }

  const maxFunctionDepth = serviceConfig.maxFunctionDepth || 1; 

  // Probably better just to config a service for JSN unless all models can support this
  let response_format;
  if (serviceConfig.json) {
    utils.logTask(T(), "Using json response_format");
    response_format = {"type": "json_object"};
  }

  //utils.logTask(T(), "Final prevMessages", prevMessages);

  return {
    systemMessage,
    prevMessages,
    noStreaming,
    prompt,
    useCache,
    modelVersion,
    temperature,
    maxTokens,
    maxResponseTokens,
    instanceId,
    cacheKeySeed,
    dummyAPI,
    serviceConfig,
    functions,
    maxFunctionDepth,
    response_format,
  };
}

export const OperatorLLM = {
  operate_async,
} 
