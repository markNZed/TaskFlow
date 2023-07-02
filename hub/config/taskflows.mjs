const taskflows = [
  {
    name: "root",
    stack: [], // Use of APPEND means we need to initialize this.
    stackTaskId: [], // Use of APPEND means we need to initialize this.
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
    APPEND_stack: ["TaskConversation"],
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
        APPEND_stack: ["TaskChat"],
        type: "TaskChat",
        config: {
          nextTask: "start",
        },
      },
    },
  },
  {
    APPEND_stack: ["TaskStepper"],
    type: "TaskStepper",
    name: "taskflow",
    parentType: "exercices",
  },
  {
    name: "example",
    parentType: "taskflow",
    tasks: {
      start: {
        APPEND_stack: ["TaskShowResponse"],
        type: "TaskShowResponse",
        config: {
          nextTask: "summarize",
          response: "Hello",
        },
      },
      summarize: {
        APPEND_stack: ["TaskLLMIO"],
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
        APPEND_stack: ["TaskLLMIO"],
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
  