import { actionThenQuery } from '../src/shared/fsm/xutils.mjs';

const tasks = [
  {
    config: {
      maxRequestCount: 100,
      maxRequestRate: 30,
      caching: [],
    },
    menu: false,
    name: "root",
  },
  {
    name: "system",
    parentName: "root",
    menu: true,
  },
  {
    CHILDREN_menu: true,
    name: "user",
    parentName: "root",
  },

  {
    name: "systemshared",
    config: {
      ceps: {
        ".*instance.*": {
          isRegex: true,
          functionName: "CEPShared",
        },
      },
    },
    parentName: "system",
    type: "TaskSystemShared",
  },
  {
    name: "systemlog",
    config: {
      ceps: {
        ".*instance.*": {
          isRegex: true,
          functionName: "CEPLog",
        },
      },
    },
    parentName: "system",
    type: "TaskSystemLog",
  }, 
  {
    initiator: true,
    name: "systemlogviewer",
    config: {
      label: "Log",
    },
    parentName: "system",
    type: "TaskSystemLogViewer",
  }, 
  {
    name: "config",
    parentName: "system",
  },
  {
    initiator: true,
    name: "systemtasksconfig",
    config: {
      label: "Tasks",
      local: {
        targetStore: "tasks",
      },
      debug: {
        debugTask: true,
      },
    },
    parentName: "config",
    type: "TaskSystemConfigEditor",
  },
  {
    initiator: true,
    name: "systemusersconfig",
    config: {
      label: "Users",
      local: {
        targetStore: "users",
      },
    },
    parentName: "config",
    type: "TaskSystemConfig",
  },
  {
    initiator: true,
    name: "systemgroupsconfig",
    config: {
      label: "Groups",
      local: {
        targetStore: "groups",
      },
    },
    parentName: "config",
    type: "TaskSystemConfig",
  },
  {
    initiator: true,
    name: "systemtasktypesconfig",
    config: {
      label: "Task Types",
      local: {
        targetStore: "tasktypes",
      },
    },
    parentName: "config",
    type: "TaskSystemConfig",
  },
  {
    name: "menu",
    parentName: "system",
    type: "TaskSystemMenu",
  },

  {
    name: "conversation",
    parentName: "user",
  },
  {
    config: {
      label: "chatGPT",
      services: {
        chat: {
          type: "openaigpt.chatgpt",
          environments: ["nodejs"],
        },
      }
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
      spawnTask: false,
      services: {
        chat: {
          type: "openaigpt.chatgpt",
          environments: ["nodejs"],
          temperature: 0.9,
        },
      },
      APPEND_caching: [
        {
          subTask: "SubTaskLLM",
          seed: ["task.name"],
          enable: true,
        }
      ],
    },
    initiator: true,
    name: "stepper1",
    parentName: "stepper",
    type: "TaskStepper",
  },
  {
    config: {
      label: "",
      nextTask: "summarize",
      local: {
        instruction: "Hello",
      },
    },
    name: "start",
    parentName: "stepper1",
    type: "TaskShowInstruction",
  },
  {
    config: {
      local: {
        inputLabel: "Respond here.",
        instruction: "Tell the user what to do",  
      },
      services: {
        chat: {
          forget: true,
          prompt: "Tell me a story about something random.",
          type: "openaigpt.chatgpt",
        },
      },
      nextTask: "structure"
    },
    name: "summarize",
    parentName: "stepper1",
    type: "TaskLLMIO",
  },
  {
    config: {
      local: {
        instruction: "This is what I think of your response",
      },
      nextTask: "stop",
      services: {
        chat: {
          forget: true,
          type: "openaigpt.chatgpt",
          promptTemplate: [
            "Provide feedback on this prompt, is it a good prompt? ",
            "\"",
            "summarize.output.userInput",
            "\""
          ],
          messagesTemplate: [
            {
              role: "user",
              text: [
                "This is a response from an earlier message",
                "summarize.output.LLMtext"
              ]
            },
            {
              role: "assistant",
              text: "OK. Thank you. What would you like me to do?"
            }
          ],
        },
      },
    },
    name: "structure",
    parentName: "stepper1",
    type: "TaskLLMIO",
  },

  {
    config: {
      label: "0-Shot",
      services: {
        chat: {
          type: "openaigpt.chatgptzeroshot",
          environments: ["nodejs"],
        }
      },
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
  },

  {
    config: {
      label: "Config",
      services: {
        chat: {
          type: "vercel.chatgpt",
          environments: ["nodejs"],
        },
        config: {
          type: "systemConfig",
          environments: ["rxjs"],
        },
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
    APPEND_environments: ["rxjs"],
    shared: {
      configTree: {},
    },
  },

  {
    name: "testing",
    initiator: true, // Needed to see this, maybe because it had no children?
    config: {
      local: {
        targetTaskId: "root.user.conversation.zeroshot.start",
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
            debug: false,
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
    parentName: "system",
    meta: {
      childrenId: ["root.user.conversation.zeroshot"],
    },
    type: "TaskSystemTest",
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
  
];

export { tasks };
