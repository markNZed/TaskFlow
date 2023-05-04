const components = [
  {
    name: "root",
    filter_for_client: [
      // parameter names that will NOT be stripped from the Task when sent from the server to the client
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
    filter_for_server: [
      // parameter names that will be stripped from the Task when sent from the server to the client
      "APPEND_component",
      "parent",
      "parentId",
      "parentInstanceId",
      "agent",
      "groups",
      "parentId",
      "sessionId",
      "created",
      "userId",
      "prompt",
      "assemble_prompt",
      "last_change",
      "update",
      "delta_step",
      "messages_template",
      "messages",
      "model",
    ],
  },
  {
    name: "TaskChat",
    parent: "root",
    menu: false,
    APPEND_filter_for_client: [
      "client_prompt",
      "suggested_prompts",
      "response",
    ],
  },
  {
    name: "TaskConversation",
    parent: "root",
    APPEND_filter_for_client: ["welcome_message"],
    menu: false,
  },
  {
    name: "TaskStepper",
    parent: "root",
  },
  {
    name: "TaskFromAgent",
    parent: "root",
    APPEND_filter_for_client: [
      "response",
      "input",
      "input_label",
      "instruction",
    ],
  },
  {
    name: "TaskShowResponse",
    parent: "root",
    APPEND_filter_for_client: ["response"],
  },
  {
    name: "TaskChoose",
    parent: "root",
  },
];

export { components };