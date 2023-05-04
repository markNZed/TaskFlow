function mergeTasks(a, b) {
  if (!b) {
    return a;
  }

  for (const [key, value] of Object.entries(b)) {
    if (Array.isArray(value)) {
      a[key] = [...value];
    } else if (typeof value === "object" && value !== null) {
      a[key] = mergeTasks(a[key] || {}, value);
    } else if (value !== undefined) {
      a[key] = value;
    }
  }

  return a;
}

function setDeepValue(obj, path, value) {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!current.hasOwnProperty(key)) {
      current[key] = isNaN(path[i + 1]) ? {} : [];
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
}

function isDeepValueSet(obj, path) {
  let current = obj;
  for (const key of path) {
    if (!current.hasOwnProperty(key)) {
      return false;
    }
    current = current[key];
  }
  return current !== undefined;
}

export function fromV01toV02(taskV01) {
  //console.log("fromV01toV02 taskV01", taskV01);

  let taskV02 = {
    config: {},
    input: {},
    output: {},
    privacy: {},
    request: {},
    response: {},
    state: {},
  };

  //taskV02 = mergeTasks(taskV02, taskV01)
  //taskV02 = JSON.parse(JSON.stringify(taskV02)) // deep copy

  //console.log("fromV01toV02 taskV02 after merge", taskV02);

  const v01Mapping = {
    "config.collaborate": "collaborate",
    "config.instruction": "instruction",
    "config.label": "label",
    "config.messagesTemplate": "messages_template",
    "config.nextStates": "steps",
    "config.promptTemplate": "assemble_prompt",
    "config.suggestedPrompts": "suggested_prompts",
    "config.welcomeMessage": "welcome_message",
    "config.nextStateTemplate": "next_template",
    "config.restoreSession": "restore_session",
    "config.sessionId": "sessionId",
    "config.serverOnly": "server_only",
    "config.oneThread": "oneThread",
    "config.useAddress": "useAddress",
    children: "children",
    childrenInstances: "childInstance",
    createdAt: "created",
    error: "error",
    permissions: "groups",
    id: "id",
    groupId: "groupId",
    initiator: "menu",
    instanceId: "instanceId",
    name: "name",
    nextTask: "next",
    parentId: "parentId",
    parentInstanceId: "parentInstanceId",
    parentType: "parent",
    stack: "component",
    stackPtr: "component_depth",
    threadId: "threadId",
    updateCount: "update_count",
    updatedAt: "last_change",
    userId: "userId",
    send: "update",
    "request.address": "address",
    "request.agent": "agent",
    "request.dyad": "dyad",
    "request.model": "model",
    "request.temperature": "temperature",
    "request.maxTokens": "maxTokens",
    "request.newAddress": "new_address",
    "request.forget": "forget",
    "request.inputLabel": "input_label",
    "request.messages": "messages",
    "request.input": "client_prompt",
    "request.prompt": "prompt",
    "response.system_message": "system_message",
    "response.text": "response",
    "response.useCache": "use_cache",
    "response.userInput": "input",
    "response.updated": "updated",
    "response.updating": "updating",
    "state.current": "step",
    "state.deltaState": "delta_step",
    "state.done": "done",
    "state.nextState": "next_step",
  };

  for (const v02Path of Object.keys(v01Mapping)) {
    const v01Key = v01Mapping[v02Path];
    const v02PathArray = v02Path.split(".");

    if (taskV01.hasOwnProperty(v01Key) && taskV01[v01Key] !== undefined) {
      //console.log("setDeepValue", v01Key, v02PathArray, taskV01[v01Key])
      setDeepValue(taskV02, v02PathArray, taskV01[v01Key]);
    }
  }

  //console.log("fromV01toV02 taskV02", taskV02);
  return taskV02;
}

// Create a default object for taskV01 schema
const defaultTaskV01 = {
  agent: "",
  assemble_prompt: [],
  children: [],
  client_prompt: "",
  component: [],
  component_depth: 0,
  created: "",
  delta_step: "",
  done: false,
  forget: false,
  groups: [],
  id: "",
  input: "",
  input_label: "",
  instanceId: "",
  instruction: "",
  label: "",
  last_change: "",
  menu: false,
  messages: [],
  messages_template: [],
  name: "",
  next: "",
  next_step: "",
  parent: "",
  parentId: "",
  parentInstanceId: "",
  prompt: "",
  response: "",
  sessionId: "",
  step: "",
  steps: {},
  suggested_prompts: [],
  threadId: "",
  update: false,
  updated: false,
  updating: false,
  update_count: 0,
  userId: "",
  welcome_message: "",
  one_thread: false,
  use_address: false,
  v02: {},
};

export function fromV02toV01(taskV02) {
  //console.log("fromV02toV01 taskV02", taskV02);
  // Merge taskV01 with defaultTaskV01 to initialize undefined keys
  //let taskV01 = { ...defaultTaskV01, ...taskV02 };
  let taskV01 = JSON.parse(JSON.stringify(taskV02)); // deep copy

  const v02Mapping = {
    address: "request.address",
    client_prompt: "request.input",
    collaborate: "config.collaborate",
    component: "stack",
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

  for (const key of Object.keys(v02Mapping)) {
    const v02Path = v02Mapping[key].split(".");
    let tempObj = taskV02;

    for (const prop of v02Path) {
      if (tempObj.hasOwnProperty(prop)) {
        tempObj = tempObj[prop];
      } else {
        tempObj = null;
        break;
      }
    }

    // Only update if taskV01 has the default value
    // Avoids overwriting V1 values that are not yet set in V2
    if (tempObj !== null) {
      //} && taskV01[key] === defaultTaskV01[key]) {
      taskV01[key] = tempObj;
    }
  }

  //console.log("fromV02toV01 taskV01", taskV01);
  return taskV01;
}
