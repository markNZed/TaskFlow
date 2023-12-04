
import { CACHE_ENABLE } from "../../config.mjs";

const tasktypes = [
  {
    name: "TaskCircle",
    environments: ["react"],
    state: {
      current: "start",
    },
  },
  {
    name: "TaskUsers",
    environments: ["react", "rxjs-hub-consumer"],
    state: {
      current: "start",
    },
  },
  // TaskChatRAG is not a base type but serves as a template and sets the type to TaskChat
  // So we need to keep TaskChatRAG aligned with TaskChat
  {
    name: "TaskChatRAG",
    streaming: true,
    // If multiple environments then it will be synchronized
    environments: ["react", "rxjs-processor-consumer"],
    config: {
      local: {
        regexProcessMessages: [
          ["<BEGIN>", ""],
          ["<END>", ""],
        ],
        rewritePrompt_EN: `Answer this question or if you do not have enough information then provide a JSON list of concepts and definitions that could help clarify this question.`,
        rewritePrompt_FR: `Répondez à cette requête ou, si vous n'avez pas suffisamment d'informations, fournissez une liste JSON de concepts et définitions qui pourraient aider à clarifier cette question:`,
        contextPrompt_EN: `Use the following pieces of context to answer the question at the end. If you're not sure, just say so. If there are multiple possible answers, summarize them as possible answers.`,
        contextPrompt_FR: `Utilisez les éléments de contexte suivants pour répondre à la question à la fin. Si vous n'êtes pas sûr, dites-le simplement. S'il y a plusieurs réponses possibles, résumez-les comme réponses possibles.`,
        searchingMessage_EN: `I could not immediately find relevant information to your question, so I am searching for more information. Please wait, this can take some time.`,
        searchingMessage_FR: "Je n'ai pas pu trouver immédiatement des informations pertinentes à votre question, donc je recherche davantage d'informations. Veuillez patienter, cela peut prendre un certain temps.",
        respondingMessage_EN: `I found some relevant information, now I'm reading it and will respond shortly.`,
        respondingMessage_FR: `J'ai trouvé des informations pertinentes, maintenant je les lis et je répondrai sous peu!`,
        promptPlaceholder_EN: "Type your question here.",
        promptPlaceholder_FR: "Tapez votre question ici.",
      },
    },
    operators: {
      "LLM": {
        type: "RAG",
        environments: ["rxjs-processor-consumer"],
      }
    },
    state: {
      current: "start",
    },
    type: "TaskChat",
    shared: {
      corpusName: '',
      user: '',
      topic: '',
    },
  },
  {
    name: "TaskRAGPreprocessing",
    environments: ["rxjs-processor-consumer"],
    config: {
      local: {
        coordinates: false,
        encoding: "utf-8",
        ocrLanguages: "eng", // fra French
        outputFormat: "json",
        includePageBreaks: true,
        strategy: "auto",
      },
    },
    state: {
      current: "start",
    },
    operators: {
      LLM: {
        environments: ["rxjs-processor-consumer"],
      },
    },
    services: {
      chat: {
        type: "openaigpt.rag-dataprocessing",
        environments: ["rxjs-processor-consumer"],
      },
    },
  },
  {
    name: "TaskRAG",
    environments: ["rxjs-processor-consumer", "react"],
    config: {
    },
    state: {
      current: "start",
    },
    connections: [
      [":output.chat.services",                            "chat:services"], // How to map entire :output.chat to chat: ? Can change modelVersion
      [":output.config.local.cachePrefix",                 "chat:config.local.cachePrefix"], // config should proabbly be static 
      [":output.select.config.local.fields",               "select:config.local.fields"], // update selection options
      [":output.select.input.selectedOptions",             "select:input.selectedOptions"], // override/force selections
      ["select:output.selected",                           ":input.select"], // 
    ],
    shared: {
      corpusName: '',
      RAGUser: '',
      topic: '',
    },
  },
  {
    name: "TaskWeaviate",
    state: {
      current: "start",
    },
  },
  {
    name: "Taskflow",
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
      local: {
        autoStartEnvironment: "rxjs-hub-coprocessor",
      },
    },
  },
  {
    name: "TaskCEPFamilyTree",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      local: {
        autoStartEnvironment: "rxjs-hub-coprocessor",
      },
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
    name: "TaskLogin",
    environments: ["react", "rxjs-hub-consumer"],
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSystemMenu",
    environments: ["react", "rxjs-hub-consumer"],
    config: {
      sort: true,
      shared: {
        system: {
          "config-hub-consumer-tasks": "read", // Read only
        },
      }
    },
    state: {
      current: "start",
      legal: ["start", "loaded", "ready"],
    },
    shared: {
      system: {
        "config-hub-consumer-tasks": {},
      },
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
      local: {
        autoStartEnvironment: "rxjs-hub-coprocessor",
        autoStartCoprocessor: true,
        autoStartpriority: "1",
      },
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskLog",
    environments: ["react", "rxjs-hub-consumer"],
    config: {
      local: {
        rowDetailHeight: 500,
        pageSize: 100,
      },
    },
    state: {
      current: "start",
    },
  },
  {
    name: "TaskSelect",
    environments: ["react"],
    output: {
      selected: {},
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
    services: {
      chat: {
        environments: ["rxjs-processor-consumer"],
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
      legal: ["start", "input", "mentionAddress", "send", "configFunctionRequest", "configFunctionResponse", "receiving", "received"],
      stable: ["input"],
    },
  },
  {
    name: "TaskConversation",
    environments: ["react", "rxjs-processor-consumer"],
    config: {
      spawnTask: true,
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
    shared: {
      stepper: {},
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