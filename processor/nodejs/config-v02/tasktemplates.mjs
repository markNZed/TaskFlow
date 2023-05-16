const tasktemplates = [
  {
    filter_for_browser: [
      "id",
      "component",
      "component_depth",
      "next",
      "forget",
      "name",
      "label",
      "instanceId",
      "threadId",
      "children",
      "done",
      "steps",
      "step",
      "next_step",
      "menu",
      "update_count",
      "one_thread",
      "use_address",
    ],
    name: "root",
  },
  {
    APPEND_filter_for_browser: [
      "client_prompt",
      "suggested_prompts",
      "response",
    ],
    initiator: false,
    name: "TaskChat",
    parentType: "root",
  },
  {
    APPEND_filter_for_browser: ["welcome_message"],
    initiator: false,
    name: "TaskConversation",
    parentType: "root",
  },
  {
    name: "TaskStepper",
    parentType: "root",
  },
  {
    APPEND_filter_for_browser: [
      "response",
      "input",
      "input_label",
      "instruction",
    ],
    name: "TaskLLMIO",
    parentType: "root",
  },
  {
    APPEND_filter_for_browser: ["response"],
    name: "TaskShowResponse",
    parentType: "root",
  },
  {
    name: "TaskChoose",
    parentType: "root",
  },
];

export { tasktemplates };
