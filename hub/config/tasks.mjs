import { validateTasks } from "../src/validateTasks.mjs";
import { actionThenQuery } from '../src/shared/fsm/xutils.mjs';

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
          environments: ["nodejs"],
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
          environments: ["nodejs"],
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
          type: "openaigpt.configchat",
          useCache: false,
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
      tasksConfigTree: {},
    },
    config: {
      local: {
        suggestedPrompts: [
          "What is the id of the parent of this task?",
          "What is the path of the label of a task and how did you decide?",
          "What is the 'label' of the parent of this task?",
          "Please update the label of the parent of the current task to ConfigXXX and describe how you did this",
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
    parentName: "user",
    meta: {
      childrenId: ["root.user.conversation.zeroshot"],
    },
    type: "TaskTest",
  },

];

//console.log(JSON.stringify(tasks, null, 2));

export { tasks };
