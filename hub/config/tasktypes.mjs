
import { CACHE_ENABLE } from "../config.mjs";

const tasktypes = [
  {
    name: "TaskSelect",
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
    }
  },
  {
    name: "TaskChat",
    websocket: true,
    // If multiple environments then it will be synchronized
    environments: ["react", "nodejs", "rxjs"],
    config: {
      local: {
        promptPlaceholder_FR: "Écrivez votre prompt ici.",
        promptPlaceholder_EN: "Write your prompt here.",
        /*
        regexProcessPrompt: [
          ["^", "<BEGIN>"],
          ["$", "<END>"],
        ],
        */
        regexProcessMessages: [
          ["<BEGIN>", ""],
          ["<END>", ""],
        ],
      },
      APPEND_cache: [
        {
          subTask: "SubTaskLLM",
          seed: "",
          enable: CACHE_ENABLE,
        }
      ],
    },
  },
  {
    name: "TaskConversation",
    environments: ["react", "nodejs", "rxjs"],
    config: {
      local: {
        welcomeMessage_FR: "Bienvenue ! Comment puis-je vous aider aujourd'hui ?",
        welcomeMessage_EN: "Welcome! How can I assist you today?",
        regexProcessMessages: [
          ["<BEGIN>", ""],
          ["<END>", ""],
        ],
        promptWithTime: false,
        useAddress: false,
      },
    },
  },
  {
    name: "TaskSimulateUser",
    environments: ["react", "nodejs"],
    config: {
      local: {
        introductionPrompt: "Please introduce yourself.",
      },
      APPEND_cache: [
        {
          subTask: "SubTaskLLM",
          seed: "",
          enable: CACHE_ENABLE,
        }
      ],
    },
  },
  {
    name: "TaskStepper",
    environments: ["react"],
  },
  {
    name: "TaskGrid",
    environments: ["react"],
  },
  {
    name: "TaskLLMIO",
    websocket: true,
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
    environments: ["react", "nodejs"],
    config: {
      local: {
        instruction: "",
      }
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