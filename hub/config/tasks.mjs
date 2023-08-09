const tasks = [
  {
    config: {
      maxRequestCount: 100,
      maxRequestRate: 30,
      cache: [],
    },
    menu: true,
    name: "root",
    state: {
      current: "start"
    }
  },

  {
    name: "conversation",
    parentName: "root",
  },

  {
    config: {
      label: "chatGPT",
      services: [
        {
          type: "openaigpt.chatgpt"
        }
      ],
    },
    initiator: true,
    name: "chatgpt",
    parentName: "conversation",
    type: "TaskConversation",
  },
  {
    name: "start",
    parentName: "chatgpt",
    type: "TaskChat"
  },

  {
    config: {
      label: "Exercice",
      spawnTask: false,
      services: [
        {
          temperature: 0.9,
        },
      ],
      APPEND_cache: [
        {
          subTask: "SubTaskLLM",
          seed: ["task.name"],
          enable: true,
        }
      ],
    },
    initiator: true,
    name: "exercise",
    parentName: "root",
    type: "TaskStepper"
  },
  {
    config: {
      label: "",
      nextTask: "summarize",
      local: {
        instructionTemplate: [
          "Bonjour ",
          "USER.label",
          " et bienvenue dans cet entraînement au résumé écrit. Je suis l'assistant IA de Sandrine, n'hésitez pas à contacter Sandrine si vous avez des questions après cet exercice ! Vous allez produire un résumé écrit d'environ 100 mots d'un texte qui fait environ 400 mot."
        ]
      }
    },
    name: "start",
    parentName: "exercise",
    type: "TaskShowInstruction"
  },

  {
    name: "stepper",
    parentName: "root",
  },

  {
    config: {
      label: "Example1",
      spawnTask: false,
      services: [
        {
          temperature: 0.9,
        },
      ],
      APPEND_cache: [
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
      services: [
        {
          forget: true,
          prompt: "Tell me a story about something random.",
          type: "openaigpt.chatgpt"
        },
      ],
      nextTask: "structure"
    },
    name: "summarize",
    parentName: "stepper1",
    type: "TaskLLMIO"
  },
  {
    config: {
      local: {
        instruction: "This is what I think of your response",
      },
      nextTask: "stop",
      services: [
        {
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
      ],
    },
    name: "structure",
    parentName: "stepper1",
    type: "TaskLLMIO"
  }
];

export { tasks };
