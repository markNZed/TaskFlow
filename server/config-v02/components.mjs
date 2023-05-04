const components = [
  {
    filter_for_client: [
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
    APPEND_filter_for_client: [
      "client_prompt",
      "suggested_prompts",
      "response",
    ],
    initiator: false,
    name: "TaskChat",
    parentType: "root",
  },
  {
    APPEND_filter_for_client: ["welcome_message"],
    initiator: false,
    name: "TaskConversation",
    parentType: "root",
  },
  {
    name: "TaskStepper",
    parentType: "root",
  },
  {
    APPEND_filter_for_client: [
      "response",
      "input",
      "input_label",
      "instruction",
    ],
    name: "TaskFromAgent",
    parentType: "root",
  },
  {
    APPEND_filter_for_client: ["response"],
    name: "TaskShowResponse",
    parentType: "root",
  },
  {
    name: "TaskChoose",
    parentType: "root",
  },
];

export { components };
