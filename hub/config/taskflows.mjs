const taskflows = [
  {
    name: "root",
    menu: true,
    config: {
      maxRequestCount: 100,
      maxRequestRate: 30,
    },
    state: {current: "start"},
  },
  {
    name: "exercices",
    parentType: "root",
  },
  {
    type: "TaskConversation",
    name: "conversation",
    parentType: "exercices",
  },
  {
    config: {
      label: "chatGPT",
      model: {
        type: "chatgpt",
      },
    },
    name: "chatgpt",
    parentType: "conversation",
    tasks: {
      start: {
        type: "TaskChat",
        config: {
          nextTask: "start",
        },
      },
    },
  },
  {
    type: "TaskStepper",
    name: "taskflow",
    parentType: "exercices",
  },
  {
    name: "example",
    parentType: "taskflow",
    tasks: {
      start: {
        type: "TaskShowResponse",
        config: {
          nextTask: "summarize",
          response: "Hello",
        },
      },
      summarize: {
        type: "TaskLLMIO",
        config: {
          nextTask: "structure",
          instruction: "Tell the user what to do",
          model: {
            type: "chatgpt",
            forget: true,
            prompt: "Tell me a story about something random.",
          },
          inputLabel: "Respond here.",
        },
      },
      structure: {
        type: "TaskLLMIO",
        config: {
          nextTask: "stop",
          instruction: "This is what I think of your response",
          messagesTemplate: [
            {
              role: "user",
              text: [
                "This is a response from an earlier message",
                "summarize.response",
              ],
            },
            {
              role: "assistant",
              text: "OK. Thank you. What would you like me to do?",
            },
          ],
          promptTemplate: [
            "Provide feedback on this prompt, is it a good prompt? ",
            '"',
            "summarize.input",
            '"',
          ],
        },
        model: {
          type: "chatgpt",
          forget: true,
        },
      },
    },
  },
];
  
  export { taskflows };
  