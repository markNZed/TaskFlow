/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { DUMMY_OPENAI, CONFIG_DIR } from "../../config.mjs";
import * as dotenv from "dotenv";
dotenv.config(); // For process.env.OPENAI_API_KEY

// Should we return a promise? Better to be task iin/out ?

var serviceTypes = await utils.load_data_async(CONFIG_DIR, "servicetypes");
serviceTypes = utils.flattenObjects(serviceTypes);
//console.log(JSON.stringify(serviceTypes, null, 2))

async function SubTaskLLM_async(wsSendTask, task, service) {
  const taskCopy = JSON.parse(JSON.stringify(task));
  const T = utils.createTaskValueGetter(taskCopy);
  let params = await chatPrepare_async(T);
  params["wsSendTask"] = wsSendTask;
  params["T"] = T;
  const functionName = params.serviceConfig.API + "_async";
  console.log("params.serviceConfig", params.serviceConfig);
  taskCopy.response.LLM = await callFunctionByName(service, functionName, params);
  return taskCopy;
}

function callFunctionByName(service, functionName, params) {
  const functions = {
    openaigpt_async: service.module.openaigpt_async,
    openaistub_async: service.module.openaistub_async,
  };
  const func = functions[functionName];
  if (typeof func === "function") {
    return func(params);
  } else {
    console.error(`No function named ${functionName} found in service`, service);
  }
}

function checkSubTaskCache (T, subTaskName) {
  // Loop over each object in T("config.subtasks") if it exists
  let enabled = false;
  let seed = T("id");
  if (T("config.subtasks")) {
    const subTaskConfig = T("config.subtasks")[subTaskName];
    if (subTaskConfig) {
      if (subTaskConfig.useCache !== undefined) {
        enabled = subTaskConfig.useCache;
      }
      if (subTaskConfig.seed !== undefined && subTaskConfig.seed.length) {
        for (const cacheKeySeed of subTaskConfig.seed) {
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
async function chatPrepare_async(T) {

  const instanceId = T("instanceId");
  let systemMessage = "";
  let forget = false;
  let [useCache, cacheKeySeed] = checkSubTaskCache(T, "SubTaskLLM");
  console.log("useCache config " + useCache + " seed " + cacheKeySeed);
  let noStreaming = false;

  //console.log("prompt " + prompt);
  let serviceConfig = T("config.services.chat");
  let type = serviceConfig.type;
  let serviceTypeConfig = serviceTypes[type];
  if (!serviceTypeConfig) {
    console.log("No serviceType for ", T("id"), type);
  } else {
    console.log("ServiceType for ", type, serviceTypeConfig.name, serviceTypeConfig.modelVersion);
  }

  if (serviceConfig) {
    serviceConfig = utils.deepMerge(serviceTypeConfig, serviceConfig);
  }
  if (T("request.service")) {
    serviceConfig = utils.deepMerge(serviceTypeConfig, T("request.service"));
  }
  const modelVersion = serviceConfig.modelVersion;
  const temperature = serviceConfig.temperature;
  const maxTokens = serviceConfig.maxTokens;
  const maxResponseTokens = serviceConfig.maxResponseTokens;
  console.log("maxResponseTokens " + maxResponseTokens + " maxTokens " + maxTokens  + " temperature " + temperature + " modelVersion " + modelVersion);
  let dummyAPI = serviceConfig.dummyAPI || DUMMY_OPENAI;
  console.log("dummyAPI " + dummyAPI);

  //console.log("Agent ", serviceConfig)

  let prompt;

  if (serviceConfig.prompt) {
    console.log("Found prompt in serviceConfig.prompt");
    prompt = serviceConfig.prompt;
    //console.log("Prompt " + prompt)
  } 

  if (T("request.prompt")) {
    console.log("Found prompt in request.prompt");
    prompt = T("request.prompt");
    //console.log("Request.prompt " + prompt)
  } 

  let functions;
  
  if (serviceConfig.functions) {
    console.log("Found functions in serviceConfig.functions");
    functions = serviceConfig.functions;
  } 

  if (T("config.subtasks.SubTaskLLM.promptWithTime")) {
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
    console.log("oneFamily prompt : " + prompt);
  }

  if (serviceConfig.useCache !== undefined) {
    useCache = serviceConfig.useCache;
    console.log("Task service config set cache " + useCache);
  }

  if (typeof serviceConfig?.prePrompt !== "undefined") {
    prompt = serviceConfig.prePrompt + prompt;
    console.log("Prepend serviceConfig prompt " + serviceConfig.prePrompt);
  }

  if (typeof serviceConfig?.postPrompt !== "undefined") {
    prompt += serviceConfig.postPrompt;
    console.log("Append serviceConfig prompt " + serviceConfig.postPrompt);
  }

  const environments = T("environments");
  // If the task is running on the nodejs processor we do not use websocket
  if (environments.length === 1 && environments[0] === "nodejs") {
    noStreaming = true;
    console.log("Environment noStreaming");
  }

  if (serviceConfig.noStreaming !== undefined) {
    noStreaming = serviceConfig.noStreaming;
    console.log("Request noStreaming");
  }

  if (serviceConfig.forget !== undefined) {
    forget = serviceConfig.forget
    console.log("Task config forget previous messages", serviceConfig.forget);
  }

  let messages = [];

  if (serviceConfig?.messages) {
    messages.push(...serviceConfig.messages)
    console.log(
      "Initial messages from serviceConfig " + serviceConfig.name
    );
  }

  if (serviceConfig.messages) {
    messages.push(...serviceConfig.messages)
    console.log("Found config messages");
  }

  // This is assuming the structure used in TaskChat
  if (T("input.msgs") && !forget) {
    console.log("Initializing messages from input.msgs");
    messages.push(...T("input.msgs"));
    //console.log("messages", messages);
  }

  if (serviceConfig?.systemMessage) {
    systemMessage = serviceConfig.systemMessage;
    console.log("Sytem message from serviceConfig " + serviceConfig.name);
  }

  // Replace MODEL variables in systemMessageTemplate
  if (serviceConfig.systemMessageTemplate) {
    let systemMessageTemplate = serviceConfig.systemMessageTemplate;
    console.log("systemMessageTemplate ", systemMessageTemplate);
    const regex = /(MODEL)\.([^\s.]+)/g;
    // Using replace with a callback function
    let systemMessages = systemMessageTemplate.map((template) => {
      return template.replace(regex, (match, p1, p2) => {
        if (!serviceConfig[p2]) {
          throw new Error(`serviceConfig ${p2} does not exist`);
        }
        return serviceConfig[p2];
      });
    });
    systemMessage = systemMessages.join(); 
    console.log("Sytem message from systemMessageTemplate " + T("id") + " " + systemMessage);
  }

  //console.log("messages before map of id", messages);
  // The index starts at 1 so we do not have an id === 0 as this seemed to cause issues in ChatGPTAPI
  messages = messages.map((message, index) => ({
    ...message,
    parentMessageId: index === 0 ? null : (index),
    id: (index + 1)
  }));

  if (serviceConfig.cacheKeySeed) {
    cacheKeySeed = serviceConfig.cacheKeySeed;
  }

  // Check if we need to preprocess
  if (T("config.subtasks.SubTaskLLM.regexProcessPrompt")) {
    for (const [regexStr, replacement] of T("config.subtasks.SubTaskLLM.regexProcessPrompt")) {
      let { pattern, flags } = utils.parseRegexString(regexStr);
      let regex = new RegExp(pattern, flags);
      prompt = prompt.replace(regex, replacement);
      console.log("regexProcessPrompt", regexStr, prompt);
    }
  }

  return {
    systemMessage,
    messages,
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
  };
}

export { SubTaskLLM_async }