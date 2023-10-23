import { validateTasks } from "../../src/validateTasks.mjs";
import { actionThenQuery } from '../../src/shared/FSM/xutils.mjs';

const taskSetNames = ['system'];
let taskSet = {};

const importModule = async (moduleName) => {
  try {
    const module = await import(`./tasks/${moduleName}.mjs`);
    validateTasks(module[moduleName]);
    return { [moduleName]: module[moduleName] };
  } catch (error) {
    console.error(`Failed to import ${moduleName}:`, error);
    return null;
  }
};

const importAllModules = async (taskSetNames) => {
  const promises = taskSetNames.map(moduleName => importModule(moduleName));
  const modules = await Promise.all(promises);
  return Object.assign({}, ...modules);
};

taskSet = await importAllModules(taskSetNames);

const tasks = [

  {
    config: {
      maxRequestCount: 200,
      maxRequestRate: 60,
      caching: [],
    },
    menu: false,
    name: "root",
    permissions: [
      "dev",
    ]
  },
  {
    CHILDREN_menu: true,
    name: "user",
    parentName: "root",
  },
  {
    name: "system",
    parentName: "root",
    menu: true,
  },
  ...taskSet.system,

  {
    name: "conversation",
    parentName: "user",
  },
  {
    config: {
      label: "chatGPT",
    },
    services: {
      chat: {
        type: "openaigpt.chatgpt",
        environments: ["rxjs-processor-consumer"],
        maxResponseTokens: 150,
        maxTokens: 500,
      },
    },
    initiator: true,
    name: "chatgpt",
    parentName: "conversation",
    type: "TaskConversation",
  },
  {
    name: "start",
    parentName: "chatgpt",
    type: "TaskChat",
  },

  {
    name: "stepper",
    parentName: "user",
  },

  {
    config: {
      label: "Example1",
      spawnTask: false, // Because the stepper explicitly starts tasks
      APPEND_caching: [
        {
          operator: "LLM",
          seed: ["task.name"],
          enable: true,
        }
      ],
    },
    services: {
      chat: {
        type: "openaigpt.chatgpt",
        environments: ["rxjs-processor-consumer"],
        temperature: 0.9,
      },
    },
    operators: {
      LLM: {
        environments: ["rxjs-processor-consumer"],
      }
    },
    initiator: true,
    name: "stepper1",
    parentName: "stepper",
    type: "TaskStepper",
  },
  {
    config: {
      label: "",
      nextTask: "story",
      local: {
        instruction: "Hello",
      },
    },
    name: "hello",
    parentName: "stepper1",
    type: "TaskShowInstruction",
  },
  {
    config: {
      local: {
        inputLabel: "Respond here.",
        instruction: "Tell the user a story",  
      },
      nextTask: "feedback"
    },
    services: {
      chat: {
        forget: true,
        prompt: "Tell me a story about something random.",
        type: "openaigpt.chatgpt",
        environments: ["rxjs-processor-consumer"],
      },
    },
    name: "story",
    parentName: "stepper1",
    type: "TaskLLMIO",
  },
  {
    config: {
      local: {
        instruction: "This is what I think of your story",
      },
      nextTask: "stop",
    },
    services: {
      chat: {
        environments: ["rxjs-processor-consumer"],
        forget: true,
        type: "openaigpt.chatgpt",
        promptTemplate: [
          "Provide feedback on this story, is it a good story? ",
          "\"",
          "summarize.output.userInput",
          "\""
        ],
        messagesTemplate: [
          {
            role: "user",
            text: [
              "This is a response from an earlier message",
              "story.output.LLMtext"
            ]
          },
          {
            role: "assistant",
            text: "OK. Thank you. What would you like me to do?"
          }
        ],
      },
    },
    name: "feedback",
    parentName: "stepper1",
    type: "TaskLLMIO",
  },

  {
    config: {
      label: "0-Shot",
    },
    services: {
      chat: {
        type: "openaigpt.chatgptzeroshot",
        environments: ["rxjs-processor-consumer"],
      }
    },
    initiator: true,
    name: "zeroshot",
    parentName: "conversation",
    type: "TaskConversation",
  },
  {
    name: "start",
    parentName: "zeroshot",
    type: "TaskChat",
    config: {
      debug: {
        debugTask: true,
      },
    },
},

  {
    config: {
      label: "Config",
    },
    services: {
      chat: {
        type: "openaigpt.configchat",
        useCache: false,
        environments: ["rxjs-processor-consumer"],
      },
      config: {
        type: "systemConfig",
        environments: ["rxjs-hub-consumer"],
      },
    },
    initiator: true,
    name: "configchat",
    parentName: "conversation",
    type: "TaskConversation",
  },
  {
    name: "start",
    parentName: "configchat",
    type: "TaskChat",
    APPEND_environments: ["rxjs-hub-consumer"],
    shared: {
      "config-hub-consumer-tasks": {},
    },
    config: {
      local: {
        statesSupported: ["configFunctionRequest"],
        suggestedPrompts: [
          "What is the id of the parent of this task?",
          "Given your knowledge about the paths of tasks. What is the path for the label of a task?",
          "What is the 'label' of the parent of this task?",
          "Thinking step by step specify the minimal and sufficient sequence of function calls required to update the label of your parent task to 'configXXX'",
          "Perform the task following the exact steps defined above.",
        ]
      },
      /* // Not working?
       APPEND_caching: [
        {
          enable: false,
        }
      ],
      */
    },
  },  

  {
    config: {
      label: "Dummy",
    },
    initiator: true,
    name: "dummy",
    parentName: "user",
    type: "TaskDummy",
  },
  
  {
    name: "testing",
    initiator: true, // Needed to see this, maybe because it had no children?
    config: {
      debug: {
        debugTask: true,
      },
      local: {
        timeout: 10000, // 10 seconds
      },
      fsm: {
        name: "chat",
        useMachine: true,
        devTools: true, 
        merge: {
          // The start state is defined here to demonstrate merging of states from task configs
          states: {
            ...actionThenQuery('start', [], ['findTextarea']),
          },
        },
        queries: { // Note that more queries are defined in the library
          findTextarea: {
            query: 'textarea[name="prompt"]',
            field: "value",
            debug: true,
          },
        },
        actions: { // Note that more actions are defined in the library
          enterPrompt: {
            type: "TaskChat",
            input: "promptText",
            value: "Hello World!",
            debug: true,
          },
        },
      },
      // This task is using CEP
      //   serviceStub is created via this tasks's coprocessor Task Function
      //   familyId is created via the TaskType configuration
    },
    ceps: {
      servicestub: {
        type: "servicestub",
        match: "id-root.user.conversation.zeroshot.start",
        environments: ["rxjs-hub-coprocessor"],
        args: {
          type: "openaigpt.chatgptzeroshot",
          key: "API", 
          value: "openaistub"
        },
      }
    },
    parentName: "user",
    meta: {
      childrenId: ["root.user.conversation.zeroshot"],
    },
    type: "TaskTest",
  },

  {
    name: "cephelloworld",
    type: "TaskCEPHelloWorld",
    parentName: "user",
    config: {
      autoStartEnvironment: "rxjs-hub-consumer",
      local: {
        targetTaskId: "root.user.helloworld",
        CEPSecret: "helloworld",
      }
    },
  },
  {
    name: "helloworld",
    type: "TaskHelloWorld",
    parentName: "user",
    initiator: true,
    config: {
      label: "Hello World",
      local: {
        CEPSecret: "helloworld",
      },
    }
  },

  /*
    Use Rx to communicate between RxJS Task and RxPy
    Maybe experiment with launching a Python Task during init
    Then just pass on commands via TaskRxPy
  */
  {
    name: "rxpy",
    type: "TaskRx",
    parentName: "user",
    initiator: true,
    environments: ["rxjs-processor-consumer"],
    config: {
      label: "RxPy",
      autoStartEnvironment: "rxjs-processor-consumer",
    },
  },

  {
    name: "weaviate",
    type: "TaskWeaviate",
    parentName: "user",
    initiator: true,
    environments: ["rxjs-processor-consumer", "react"],
    config: {
      label: "Weaviate",
    },
  },

  {
    config: {
      local: {
        instruction: "Testing an error by going from start -> error state.",
      },
      label: "Test Error",
      nextStates: {
        start: "error",
        error: "error", // Should not need this
      },
    },
    services: {
      chat: {
        modelVersion: "gpt-4",
        forget: true,
        maxResponseTokens: 4000,
        maxTokens: 4000,
        prompt: "Nothing here.",
        type: "openaigpt.textgenerator",
        environments: ["rxjs-processor-consumer"],
      },
    },
    name: "testerror",
    parentName: "user",
    type: "TaskLLMIO",
    initiator: true,
  },


];

//console.log(JSON.stringify(tasks, null, 2));

export { tasks };
