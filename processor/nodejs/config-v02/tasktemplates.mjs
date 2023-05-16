const tasktemplates = [
  {
    name: "root"
  },
  {
    initiator: false,
    name: "TaskChat",
    parentType: "root",
    websocket: true,
  },
  {
    initiator: false,
    name: "TaskConversation",
    parentType: "root"
  },
  {
    name: "TaskStepper",
    parentType: "root"
  },
  {
    name: "TaskLLMIO",
    parentType: "root",
    websocket: true,
  },
  {
    name: "TaskShowResponse",
    parentType: "root"
  },
  {
    name: "TaskChoose",
    parentType: "root"
  }
];

export { tasktemplates };