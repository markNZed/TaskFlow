// Get rid of the parentType and root node

const tasktemplates = [
  {
    name: "root"
  },
  {
    name: "TaskChat",
    parentType: "root",
    websocket: true,
    // If multiple environments then it will be synchronized
    environments: ["react", "nodejs"],
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
    environments: ["nodejs"],
  },
  {
    name: "TaskShowResponse",
    parentType: "root",
    environments: ["react", "nodejs"],
  },
  {
    name: "TaskChoose",
    parentType: "root",
    environments: ["nodejs"],
  }
];

export { tasktemplates };