
import { CACHE_ENABLE } from "../../config.mjs";

const tasktypes = [
  {
    name: "TaskWeaviate",
    state: {
      current: "start",
    },
  },
  {
    name: "Taskflow",
    config: {
      LOCAL_autoStartEnvironment: "react",
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskRx",
  },
  {
    name: "TaskEdit",
    environments: ["rxjs-hub-coprocessor", "react"],
  },
  {
    name: "TaskHelloWorld",
    environments: ["react"],
  },
  {
    name: "TaskCEPHelloWorld",
    environments: ["rxjs-hub-consumer"],
  },
  {
    name: "TaskCEPServiceStub",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      autoStartEnvironment: "rxjs-hub-coprocessor",
    },
  },
  {
    name: "TaskCEPFamilyTree",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      autoStartEnvironment: "rxjs-hub-coprocessor",
    },
  },
  {
    name: "TaskCEP",
  },
  {
    name: "TaskSystemRestart", 
    environments: ["react"],
  },
  {
    name: "TaskNodeConfigs",
    services: {
      systemConfig: {
        type: "systemConfig",
      },
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSystemMenu",
    environments: ["react", "rxjs-hub-consumer"],
    config: {
      sort: true,
    },
    state: {
      current: "start",
      legal: ["start", "loaded", "ready"],
    },
    shared: {
      "config-hub-consumer-tasks": {},
    },
  },
  {
    name: "TaskNodeConfigEditor",
    environments: ["react"],
    services: {
      systemConfig: {
        type: "systemConfig",
      },
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskDummy",
    environments: ["react"],
    state: {
      current: "start",
    },
  },
  {
    name: "TaskTest",
    ceps: {
      familytree: {
        type: "familytree",
        environments: ["rxjs-hub-coprocessor"],
        match: "familyId",
      },
    },
    environments: ["rxjs-processor-consumer", "react"], // Assumes we have a coprocessor
    state: {
      current: "start",
    },
  },
  {
    name: "TaskCEPShared",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      autoStartEnvironment: "rxjs-hub-coprocessor",
      autoStartCoprocessor: true,
      autoStartpriority: "1",
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSystemLogViewer",
    environments: ["react", "rxjs-hub-coprocessor"],
    config: {
      rowDetailHeight: 500,
      pageSize: 100,
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSelect",
    environments: ["react"],
    config: {
      local: {
        fields: [
          {
            singleSelection: undefined,
            type: undefined,
            options: [
              { value: "default1", label: "Default 1" },
              { value: "default2", label: "Default 2" }
            ],
          },
        ],
      }
    },
    output: {
      selected: [],
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskChat",
    streaming: true,
    // If multiple environments then it will be synchronized
    environments: ["react", "rxjs-processor-consumer"],
    config: {
      local: {
        promptPlaceholder_FR: "Écrivez votre prompt ici.",
        promptPlaceholder_EN: "Write your prompt here.",
        regexProcessMessages: [
          ["<BEGIN>", ""],
          ["<END>", ""],
        ],
      },
    },
    operators: {
      LLM: {
        type: "LLM",
        environments: ["rxjs-processor-consumer"],
        useCache: CACHE_ENABLE,
        seed: [],
        /*
        regexProcessPrompt: [
          ["^", "<BEGIN>"],
          ["$", "<END>"],
        ],
        */
      },
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskConversation",
    environments: ["react", "rxjs-processor-consumer"],
    config: {
      local: {
        welcomeMessage_FR: "Bienvenue ! Comment puis-je vous aider aujourd'hui ?",
        welcomeMessage_EN: "Welcome! How can I assist you today?",
        regexProcessMessages: [
          ["<BEGIN>", ""],
          ["<END>", ""],
        ],    
        useAddress: false,
      },
    },
    operators: {
      "LLM": {
        type: "LLM",
        environments: ["rxjs-processor-consumer"],
        promptWithTime: false,
      }
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSimulateUser",
    environments: ["react", "rxjs-processor-consumer"],
    config: {
      local: {
        introductionPrompt: "Please introduce yourself.",
      },
    },
    operators: {
      "LLM": {
        type: "LLM",
        environments: ["rxjs-processor-consumer"],
        useCache: CACHE_ENABLE,
        seed: [],
      }
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskStepper",
    environments: ["react"],
    state: {
      current: "start",
    },
  },
  {
    name: "TaskGrid",
    environments: ["react"],
  },
  {
    name: "TaskLLMIO",
    streaming: true,
    environments: ["react", "rxjs-processor-consumer"],
    config: {
      nextStates: {
        start:     "response", 
        response:  "receiving",
        receiving: "received",
        received:  "wait", 
        wait:      "stop" 
      },
      local: {
        //instruction: "",
        //inputLabel: "",
        //display: "",
      }
    },
    state: {
      current: "start",
    },
    output: {
      userInput: "",
      LLMtext: "",
    },
    operators: {
      "LLM": {
        environments: ["rxjs-processor-consumer"],
      }
    },
  },
  {
    name: "TaskShowInstruction",
    environments: ["react", "rxjs-processor-consumer", "rxjs-hub-consumer", "rxjs-hub-coprocessor"], // Added processor-consumer & rxjs-hub-coprocessor for testing of XState FSM
    config: {
      local: {
        instruction: "",
      },
      fsm: {
        useMachine: true,
      },
    },
    state: {
      current: "start",
    },
    output: {
      instruction: "",
    }
  },
  {
    name: "TaskChoose",
    environments: ["rxjs-processor-consumer"],
    operators: {
      "LLM": {},
    },
  },
  {
    name: "TaskGeneratePersona",
    environments: ["react", "rxjs-processor-consumer"],
    config: {
      local: {
        //instruction: "",
        //inputLabel: "",
        //display: "",
      },
    },
    state: {
      current: "start",
    },
  },
];

export { tasktypes };