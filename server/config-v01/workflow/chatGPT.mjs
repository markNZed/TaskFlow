const workflow_chatGPT = {
  name: "chatgpt",
  label: "chatGPT",
  parent: "conversation",
  agent: "chatgpt",
  tasks: {
    start: {
      APPEND_component: ["TaskChat"],
      next: "start",
    },
  },
};

export default workflow_chatGPT;
