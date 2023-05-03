function mergeTasks(a, b) {
    if (!b) {
      return a;
    }
  
    for (const [key, value] of Object.entries(b)) {
      if (Array.isArray(value)) {
        a[key] = [...value];
      } else if (typeof value === 'object' && value !== null) {
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
        meta: {},
        output: {},
        privacy: {},
        request: {},
        response: {},
        state: {},
    }
  
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
      "meta.children": "children",
      "meta.childrenInstances": "childInstance",
      "meta.createdAt": "created",
      "meta.error": "error",
      "meta.permissions": "groups",
      "meta.id": "id",
      "meta.groupId": "groupId",
      "meta.initiator": "menu",
      "meta.instanceId": "instanceId",
      "meta.name": "name",
      "meta.nextTask": "next",
      "meta.parentId": "parentId",
      "meta.parentInstanceId": "parentInstanceId",
      "meta.parentType": "parent",
      "meta.stack": "component",
      "meta.stackPtr": "component_depth",
      "meta.threadId": "threadId",
      "meta.updateCount": "update_count",
      "meta.updatedAt": "last_change",
      "meta.userId": "userId",
      "meta.send": "update",
      "request.address": "address",
      "request.agent": "agent",
      "request.dyad": "dyad",
      "request.model": "model",
      "request.temperature": "temperature",
      "request.maxTokens": "maxTokens",
      "request.forget": "forget",
      "request.inputLabel": "input_label",
      "request.messages": "messages",
      "request.input": "client_prompt",
      "request.prompt": "prompt",
      "response.system_message": "system_message",
      "response.text": "response",
      "response.useCache": "use_cache",
      "response.userInput": "input",
      "response.updated" : "updated",
      "response.updating" : "updating",
      "state.current": "step",
      "state.deltaState": "delta_step",
      "state.done": "done",
      "state.nextState": "next_step",
    };
  
    for (const v02Path of Object.keys(v01Mapping)) {
      const v01Key = v01Mapping[v02Path];
      const v02PathArray = v02Path.split(".");
  
      if (taskV01.hasOwnProperty(v01Key) && taskV01[v01Key] !== undefined) {
        // make sure that taskV02 is not already set but might be updating
        //if (!isDeepValueSet(taskV02, v02PathArray)) {
            console.log("setDeepValue", v01Key, v02PathArray, taskV01[v01Key])
            setDeepValue(taskV02, v02PathArray, taskV01[v01Key])
        //}
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
    let taskV01 = JSON.parse(JSON.stringify(taskV02)) // deep copy

    const v02Mapping = {
      address: "request.address",
      client_prompt: "request.input",
      collaborate: "config.collaborate",
      component: "meta.stack",
      component_depth: "meta.stackPtr",
      agent: "request.agent",
      assemble_prompt: "config.promptTemplate",
      childInstance: "meta.childrenInstances",
      children: "meta.children",
      created: "meta.createdAt",
      delta_step: "state.deltaState",
      done: "state.done",
      dyad: "request.dyad", 
      error: "meta.error",
      forget: "request.forget",
      groupId: "meta.groupId",
      groups: "meta.permissions",
      id: "meta.id",
      input: "response.userInput",
      input_label: "request.inputLabel",
      instanceId: "meta.instanceId",
      instruction: "config.instruction",
      label: "config.label",
      last_change: "meta.updatedAt",
      maxTokens: "request.maxTokens",
      messages: "request.messages",
      messages_template: "config.messagesTemplate",
      menu: "meta.initiator",
      model: "request.model",
      name: "meta.name",
      next: "meta.nextTask",
      next_step: "state.nextState",
      next_template: "config.nextStateTemplate",
      one_thread: "config.oneThread",
      parent: "meta.parentType",
      parentId: "meta.parentId",
      parentInstanceId: "meta.parentInstanceId",
      prompt: "request.prompt",
      response: "response.text",
      restore_session: "config.restoreSession",
      sessionId: "config.sessionId",
      server_only: "config.serverOnly",
      startId: "meta.id",
      step: "state.current",
      steps: "config.nextStates",
      suggested_prompts: "config.suggestedPrompts",
      temperature: "request.temperature",
      threadId: "meta.threadId",
      update: "meta.send",
      updated: "response.updated",
      updating: "response.updating",
      update_count: "meta.updateCount",
      use_cache: "response.useCache",
      userId: "meta.userId",
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
      if (tempObj !== null) { //} && taskV01[key] === defaultTaskV01[key]) {
        taskV01[key] = tempObj;
      }
    }
  
    //console.log("fromV02toV01 taskV01", taskV01);
    return taskV01;
}
  

export function fromV01toV02_gpt4(taskV01) {
    let taskV02 = {
        config: {
            instruction: taskV01.instruction,
            label: taskV01.label,
            messagesTemplate: taskV01.messages_template.map(message => {
                return {
                    content: message.content,
                    role: message.role
                };
            }),
            nextStates: taskV01.steps,
            promptTemplate: taskV01.assemble_prompt,
            suggestedPrompts: taskV01.suggested_prompts,
            welcomeMessage: taskV01.welcome_message
        },
        input: {}, // assuming you want to initialize it as an empty object
        meta: {
            baseType: "", // assuming you want to initialize it as an empty string
            children: taskV01.children,
            completedAt: "", // assuming you want to initialize it as an empty string
            createdAt: taskV01.created,
            dependencies: [], // assuming you want to initialize it as an empty array
            error: null, // assuming you want to initialize it as null
            permissions: taskV01.groups,
            id: taskV01.id,
            initiator: taskV01.menu,
            name: taskV01.name,
            nextTasks: [], // assuming you want to initialize it as an empty array
            parentId: taskV01.parentId,
            parentType: "", // assuming you want to initialize it as an empty string
            send: "", // assuming you want to initialize it as an empty string
            stack: [], // assuming you want to initialize it as an empty array
            stackPtr: 0, // assuming you want to initialize it as 0
            threadId: taskV01.threadId,
            type: "", // assuming you want to initialize it as an empty string
            updateCount: taskV01.update_count,
            updatedAt: taskV01.last_change,
            userId: taskV01.userId,
            versionExternal: "0.2", // assuming you want to initialize it as an empty string
            versionInternal: "0.0" // assuming you want to initialize it as an empty string
        },
        output: {}, // assuming you want to initialize it as an empty object
        privacy: {}, // assuming you want to initialize it as an empty object
        request: {
            agent: taskV01.agent,
            forget: taskV01.forget,
            inputLabel: taskV01.input_label,
            messages: taskV01.messages.map(message => {
                return {
                    content: message.content,
                    role: message.role
                };
            }),
            model: "", // assuming you want to initialize it as an empty string
            prompt: taskV01.input,
            temperature: 0, // assuming you want to initialize it as 0
        },
        response: {
            text: taskV01.response,
            userInput: taskV01.input
        },
        state: {
            current: taskV01.step,
            deltaState: taskV01.delta_step,
            done: taskV01.done,
            id: "", // assuming you want to initialize it as an empty string
            nextState: taskV01.next_step,
            sessionId: taskV01.sessionId
        }
    };
    return taskV02;
}

export function fromV02toV01_gpt4(taskV02) {
    let taskV01 = {
        agent: taskrequest.agent,
        assemble_prompt: taskconfig.promptTemplate,
        children: taskmeta.children,
        created: taskmeta.createdAt,
        delta_step: taskstate.deltaState,
        done: taskstate.done,
        forget: taskrequest.forget,
        groups: taskmeta.permissions,
        menu: taskmeta.initiator,
        id: taskmeta.id,
        input: taskresponse.userInput,
        input_label: taskrequest.inputLabel,
        instruction: taskconfig.instruction,
        last_change: taskmeta.updatedAt,
        messages: taskrequest.messages.map(message => {
            return {
                content: message.content,
                role: message.role
            };
        }),
        messages_template: taskconfig.messagesTemplate.map(message => {
            return {
                content: message.content,
                role: message.role
            };
        }),
        name: taskmeta.name,
        next_step: taskstate.nextState,
        parentId: taskmeta.parentId,
        prompt: taskrequest.prompt,
        response: taskresponse.text,
        step: taskstate.current,
        steps: taskconfig.nextStates,
        suggested_prompts: taskconfig.suggestedPrompts,
        threadId: taskmeta.threadId,
        update_count: taskmeta.updateCount,
        userId: taskmeta.userId,
        welcome_message: taskconfig.welcomeMessage
    };
    return taskV01;
}
