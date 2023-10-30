
import { CACHE_ENABLE } from "../../config.mjs";

const tasktypes = [
  // TaskChatRAG is not a base type but serves as a template and sets the type to TaskChat
  // So we need to keep TaskChatRAG aligned with TaskChat
  {
    name: "TaskChatRAG",
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
        // Could tansfer to tasktype: rewritePrompt, contextPrompt, searchingMessage, respondingMessage
        rewritePrompt_EN: `Answer this question or if you do not have enough information then provide a bullet list of concepts that could help clarify this question.`,
        rewritePrompt_FR: `Répondez à cette requête ou, si vous n'avez pas suffisamment d'informations, fournissez une liste à puces de concepts qui pourraient aider à clarifier cette question:`,
        contextPrompt_EN: `Use the following pieces of context to answer the question at the end. If you're not sure, just say so. If there are multiple possible answers, summarize them as possible answers.`,
        contextPrompt_FR: `Utilisez les morceaux de contexte suivants pour répondre à la question à la fin. Si le contexte est le message 'NO INFORMATION AVAILABLE', alors ne fournissez pas de réponse et présentez des excuses. Si vous n'êtes pas sûr, dites-le simplement. S'il y a plusieurs réponses possibles, résumez-les comme des réponses possibles.`,
        searchingMessage_EN: `I could not immediately find relevant information to your question, so I am searching for more information. Please wait, this can take some time.`,
        searchingMessage_FR: "Je n'ai pas pu trouver immédiatement des informations pertinentes à votre question, donc je recherche davantage d'informations. Veuillez patienter, cela peut prendre un certain temps.",
        respondingMessage_EN: `I found some relevant information, now I'm reading it and will respond shortly.`,
        respondingMessage_FR: `J'ai trouvé des informations pertinentes, maintenant je les lis et je répondrai sous peu!`,
        //noInformation: "Nous sommes désolés, mais nous n'avons pas de réponse disponible pour votre demande actuelle. Pour obtenir de l'aide ou des informations supplémentaires, veuillez contacter directement Domène Technologies Formations par téléphone 04 76 77 55 00 ou par e-mail contact@domene-technologies-formations.fr",
        helpMessage_FR: `Pour obtenir de l'aide ou des informations supplémentaires, veuillez contacter directement Domène Technologies Formations par téléphone 04 76 77 55 00 ou par e-mail contact@domene-technologies-formations.fr`,
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
  },
  {
    name: "TaskRAGPreprocessing",
    environments: ["rxjs-processor-consumer"],
    config: {
      local: {
        coordinates: false,
        encoding: "utf-8",
        ocrLanguages: "frm", // French
        outputFormat: "json",
        includePageBreaks: true,
        strategy: "hi_res",
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
  },
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