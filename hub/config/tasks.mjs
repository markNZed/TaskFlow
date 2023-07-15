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
    name: "exercices",
    parentName: "root"
  },
  {
    name: "conversation",
    parentName: "exercices",
    type: "TaskConversation"
  },
  {
    config: {
      label: "chatGPT",
      service: {
        type: "chatgpt"
      }
    },
    initiator: true,
    name: "chatgpt",
    parentName: "conversation"
  },
  {
    config: {
      nextTask: "start"
    },
    name: "start",
    parentName: "chatgpt",
    type: "TaskChat"
  },
  {
    name: "taskflow",
    parentName: "exercices",
    type: "TaskStepper"
  },
  {
    name: "example",
    parentName: "taskflow",
    initiator: true,
  },
  {
    config: {
      nextTask: "summarize",
      response: "Hello"
    },
    name: "start",
    parentName: "example",
    type: "TaskShowResponse"
  },
  {
    config: {
      inputLabel: "Respond here.",
      instruction: "Tell the user what to do",
      service: {
        forget: true,
        prompt: "Tell me a story about something random.",
        type: "chatgpt"
      },
      nextTask: "structure"
    },
    name: "summarize",
    parentName: "example",
    type: "TaskLLMIO"
  },
  {
    config: {
      instruction: "This is what I think of your response",
      messagesTemplate: [
        {
          role: "user",
          text: [
            "This is a response from an earlier message",
            "summarize.response"
          ]
        },
        {
          role: "assistant",
          text: "OK. Thank you. What would you like me to do?"
        }
      ],
      nextTask: "stop",
      promptTemplate: [
        "Provide feedback on this prompt, is it a good prompt? ",
        "\"",
        "summarize.input",
        "\""
      ]
    },
    service: {
      forget: true,
      type: "chatgpt"
    },
    name: "structure",
    parentName: "example",
    type: "TaskLLMIO"
  }
];

export { tasks };
