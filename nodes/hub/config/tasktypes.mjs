
import { CACHE_ENABLE } from "../config.mjs";

const tasktypes = [
  {
    name: "TaskCEPHelloWorld",
    environments: ["rxjs"],
    config: {
      autoStartEnvironment: "rxjs",
    },
  },
  {
    name: "TaskCEPServiceStub",
    environments: ["rxjscopro"],
    config: {
      autoStartEnvironment: "rxjscopro",
    },
  },
  {
    name: "TaskCEPFamilyTree",
    environments: ["rxjscopro"],
    config: {
      autoStartEnvironment: "rxjscopro",
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
      config: {
        type: "systemConfig",
      },
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSystemMenu",
    environments: ["react", "rxjs"],
    config: {
      sort: true,
    },
    state: {
      current: "start",
      legal: ["start", "loaded", "ready"],
    },
    shared: {
      configTreeHubconsumerTasks: {},
    },
  },
  {
    name: "TaskNodeConfigEditor",
    environments: ["react"],
    services: {
      config: {
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
        environments: ["rxjscopro"],
        match: "familyId",
      },
    },
    environments: ["nodejs", "react"], // Assumes we have a coprocessor
    state: {
      current: "start",
    },
  },
  {
    name: "TaskCEPShared",
    environments: ["rxjscopro"],
    config: {
      autoStartEnvironment: "rxjscopro",
      autoStartCoProcessor: true,
      autoStartpriority: "1",
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSystemLogViewer",
    environments: ["react", "rxjscopro"],
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
    environments: ["react", "nodejs"],
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
        environments: ["nodejs"],
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
    environments: ["react", "nodejs"],
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
        environments: ["nodejs"],
        promptWithTime: false,
      }
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSimulateUser",
    environments: ["react", "nodejs"],
    config: {
      local: {
        introductionPrompt: "Please introduce yourself.",
      },
    },
    operators: {
      "LLM": {
        type: "LLM",
        environments: ["nodejs"],
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
    environments: ["react", "nodejs"],
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
    }
  },
  {
    name: "TaskShowInstruction",
    environments: ["react", "nodejs", "rxjs", "rxjscopro"], // Added rxjs & rxjscopro for testing of XState FSM
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
    environments: ["nodejs"],
  },
  {
    name: "TaskGeneratePersona",
    environments: ["react", "nodejs"],
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