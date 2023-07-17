
import { CACHE_ENABLE } from "../config.mjs";

const tasktypes = [
  {
    name: "TaskSelect",
    config: {
      selectUI: 'checkboxes',
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
      welcomeMessage_FR: "Bienvenue ! Comment puis-je vous aider aujourd'hui ?",
      welcomeMessage_EN: "Welcome! How can I assist you today?",
      promptPlaceholder_FR: "Écrivez votre prompt ici.",
      promptPlaceholder_EN: "Write your prompt here.",
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
  },
  {
    name: "TaskSimulateUser",
    environments: ["react", "nodejs"],
    config: {
      //introductionPrompt: "Please introduce yourself.",
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
    name: "TaskShowResponse",
    environments: ["react", "nodejs"],
    config: {
      response: "",
    },
    state: {
      current: "start",
    },
    output: {
      response: "",
    }
  },
  {
    name: "TaskChoose",
    environments: ["nodejs"],
  }
  ,
  {
    name: "TaskGeneratePersona",
    environments: ["react", "nodejs"],
    state: {
      current: "start",
    },
  },
];

export { tasktypes };