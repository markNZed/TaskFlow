const tasktypes = [
  {
    name: "root"
  },
  {
    name: "TaskChat",
    parentType: "root",
    websocket: true,
    // If multiple environments then it will be synchronized
    environments: ["react", "nodejs"],
    config: { 
      welcomeMessage_FR: "Bienvenue ! Comment puis-je vous aider aujourd'hui ?",
      welcomeMessage_EN: "Welcome! How can I assist you today?",
      promptPlaceholder_FR: "Écrivez votre prompt ici.",
      promptPlaceholder_EN: "Write your prompt here."
    },
    state: {
      current: "input",
    },
    output: {
      msgs: [],
    }
  },
  {
    name: "TaskConversation",
    parentType: "root",
    environments: ["react", "nodejs"],
  },
  {
    name: "TaskStepper",
    parentType: "root",
    environments: ["react"],
  },
  {
    name: "TaskGrid",
    parentType: "root",
    environments: ["react"],
  },
  {
    name: "TaskLLMIO",
    parentType: "root",
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
    parentType: "root",
    environments: ["react", "nodejs"],
    state: {
      current: "start",
    },
    output: {
      response: "",
    }
  },
  {
    name: "TaskChoose",
    parentType: "root",
    environments: ["nodejs"],
  }
  ,
  {
    name: "TaskGeneratePersona",
    parentType: "root",
    environments: ["react", "nodejs"],
    state: {
      current: "start",
    },
  },
];

export { tasktypes };