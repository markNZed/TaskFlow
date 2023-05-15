const taskflows = [
  {
    initiator: false,
    name: "root",
    stack: [],
  },
  {
    initiator: true,
    name: "exercices",
    parentType: "root",
  },
  {
    APPEND_stack: ["TaskConversation"],
    name: "conversation",
    parentType: "exercices",
  },
  {
    config: {
      label: "chatGPT",
    },
    name: "chatgpt",
    parentType: "conversation",
    request: {
      modeltemplate: "chatgpt",
    },
    tasks: {
      start: {
        APPEND_stack: ["TaskChat"],
        nextTask: "start",
      },
    },
  },
  {
    APPEND_stack: ["TaskStepper"],
    name: "taskflow",
    parentType: "exercices",
  },
  {
    name: "example",
    parentType: "taskflow",
    tasks: {
      start: {
        APPEND_stack: ["TaskShowResponse"],
        nextTask: "summarize",
        config: {
          text: "Hello",
        },
      },
      summarize: {
        APPEND_stack: ["TaskFromAgent"],
        config: {
          instruction: "Tell the user what to do",
        },
        nextTask: "structure",
        request: {
          modeltemplate: "chatgpt",
          forget: true,
          inputLabel: "Respond here.",
          prompt: "Tell me a story about something random.",
        },
        response: {
          text: "",
          userInput: "",
        },
      },
      structure: {
        APPEND_stack: ["TaskFromAgent"],
        config: {
          instruction: "This is what I think of your response",
          messagesTemplate: [
            {
              role: "user",
              content: [
                "This is a response from an earlier message",
                "summarize.response",
              ],
            },
            {
              role: "assistant",
              content: "OK. Thank you. What would you like me to do?",
            },
          ],
          promptTemplate: [
            "Provide feedback on this prompt, is it a good prompt? ",
            '"',
            "summarize.input",
            '"',
          ],
        },
        nextTask: "stop",
        request: {
          modeltemplate: "chatgpt",
          forget: true,
        },
      },
    },
  },
];

export { taskflows };
