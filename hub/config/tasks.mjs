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
      services: [
        {
          type: "openaigpt.chatgpt"
        }
      ],
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
    type: "TaskShowInstruction"
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
    parentName: "example",
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
            "summarize.input",
            "\""
          ],
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
        },
      ],
    },
    name: "structure",
    parentName: "example",
    type: "TaskLLMIO"
  }
];

export { tasks };
