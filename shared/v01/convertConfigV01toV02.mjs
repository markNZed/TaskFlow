const v02Mapping = {
  address: "request.address",
  client_prompt: "request.input",
  collaborate: "config.collaborate",
  component: "stack",
  APPEND_component: "APPEND_stack", //Added for config
  component_depth: "stackPtr",
  agent: "request.agent",
  assemble_prompt: "config.promptTemplate",
  childInstance: "childrenInstances",
  children: "children",
  created: "createdAt",
  delta_step: "state.deltaState",
  done: "state.done",
  dyad: "request.dyad",
  error: "error",
  APPEND_filter_for_client: "APPEND_filter_for_client", //Added for config
  filter_for_client: "filter_for_client", //Added for config
  forget: "request.forget",
  groupId: "groupId",
  groups: "permissions",
  id: "id",
  input: "response.userInput",
  input_label: "request.inputLabel",
  instanceId: "instanceId",
  instruction: "config.instruction",
  label: "config.label",
  last_change: "updatedAt",
  maxTokens: "request.maxTokens",
  messages: "request.messages",
  messages_template: "config.messagesTemplate",
  menu: "initiator",
  model: "request.model",
  name: "name",
  new_address: "request.newAddress",
  next: "nextTask",
  next_step: "state.nextState",
  next_template: "config.nextStateTemplate",
  one_thread: "config.oneThread",
  parent: "parentType",
  parentId: "parentId",
  parentInstanceId: "parentInstanceId",
  prompt: "request.prompt",
  response: "response.text",
  restore_session: "config.restoreSession",
  sessionId: "config.sessionId",
  server_only: "config.serverOnly",
  startId: "id",
  step: "state.current",
  steps: "config.nextStates",
  suggested_prompts: "config.suggestedPrompts",
  tasks: "tasks", // Added to help with mapping
  temperature: "request.temperature",
  threadId: "threadId",
  update: "send",
  updated: "response.updated",
  updating: "response.updating",
  update_count: "updateCount",
  use_cache: "response.useCache",
  userId: "userId",
  welcome_message: "config.welcomeMessage",
  use_address: "config.useAddress",
};

// This is only mapping when it exists
function updateDataStructure(obj) {
  const updatedObj = {};

  // Get the keys of v02Mapping and sort them in the desired order
  const orderedKeys = Object.keys(v02Mapping).sort((a, b) => {
    // Define your custom sorting logic here
    // Example: sort by the mapped key
    return v02Mapping[a].localeCompare(v02Mapping[b]);
  });

  for (const key of orderedKeys) {
    const newKey = v02Mapping[key];
    const value = obj[key];

    if (value !== undefined) {
      if (newKey.includes(".")) {
        const [firstPart, secondPart] = newKey.split(".");
        if (!updatedObj[firstPart]) {
          //console.log("THERE", firstPart, value)
          updatedObj[firstPart] = {};
        }
        updatedObj[firstPart][secondPart] = value;
      } else {
        updatedObj[newKey] = value;
      }
    }
  }

  return updatedObj;
}

import fs from "fs/promises";
import fsExtra from "fs-extra";

/*
import workflow_leguide from '/app/chat-config/workflow/leguide.mjs';
import workflow_summary from '/app/chat-config/workflow/summary.mjs';
import workflow_testing from '/app/chat-config/workflow/testing.mjs';
import { workflows } from '/app/chat-config/workflows.mjs';
import { components } from '/app/chat-config/components.mjs';

const filenames = {
  'workflows' : '/app/chat-config-v02/workflows.mjs', 
  'workflow_leguide' : '/app/chat-config-v02/workflow/leguide.mjs', 
  'workflow_summary' : '/app/chat-config-v02/workflow/summary.mjs', 
  'workflow_testing' : '/app/chat-config-v02/workflow/testing.mjs',
  'components' : '/app/chat-config-v02/components.mjs',
}

const SRCDIR = '/app/chat-config';
const DESTDIR = '/app/chat-config-v02';

const dataStructures = {
    workflows,
    workflow_leguide,
    workflow_summary,
    workflow_testing,
    components,
};

*/

import { workflows } from "../server/config/workflows.mjs";
import { components } from "../server/config/components.mjs";

const filenames = {
  workflows: "../server/config-v02/workflows.mjs",
  components: "../server/config-v02/components.mjs",
};

const SRCDIR = "../server/config";
const DESTDIR = "../server/config-v02";

const dataStructures = {
  workflows,
  components,
};

function updateNestedTasks(data) {
  if (data.tasks) {
    for (const taskId in data.tasks) {
      const updatedItem = updateDataStructure(data.tasks[taskId]);
      data.tasks[taskId] = updatedItem;
    }
  }
  return data;
}

async function modifyAndSaveFiles() {
  for (const key in filenames) {
    const originalData = dataStructures[key];
    let updatedData;
    if (Array.isArray(originalData)) {
      updatedData = originalData.map((item) => {
        const updatedItem = updateDataStructure(item);
        updateNestedTasks(updatedItem);
        return updatedItem;
      });
    } else {
      updatedData = updateDataStructure(originalData);
      updateNestedTasks(updatedData);
    }

    const outputFilename = filenames[key];
    const jsonString = JSON.stringify(updatedData, null, 2);
    const formattedJsonString = jsonString.replace(/"([^"]+)":/g, "$1:");
    const fileContent = `const ${key} = ${formattedJsonString};\n\nexport { ${key} };`;

    try {
      await fs.writeFile(outputFilename, fileContent, "utf8");
      console.log(`File ${outputFilename} saved successfully.`);
    } catch (err) {
      console.error(`Error writing the file ${outputFilename}:`, err);
    }
  }
}

async function copyAndReplace() {
  try {
    // Ensure the destination directory exists
    await fsExtra.ensureDir(DESTDIR);

    // Copy the source directory to the destination directory
    // If the destination directory contains files, they will be replaced
    await fsExtra.copy(SRCDIR, DESTDIR, { overwrite: true });

    console.log(
      `Copied '${SRCDIR}' to '${DESTDIR}' and replaced existing files.`
    );
  } catch (err) {
    console.error(`Error copying and replacing files: ${err.message}`);
  }
}

// Copy '/app/chat-config' to '/app/chat-config-v02'
await copyAndReplace();
// Operate on '/app/chat-config-v02'
await modifyAndSaveFiles();

//node --experimental-modules convertConfigV01toV02.mjs
