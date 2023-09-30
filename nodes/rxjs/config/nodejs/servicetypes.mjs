const currentDate = new Date().toISOString().split("T")[0];

// This is an array because we use the same structure as other configdata
const servicetypes = [
  {
    name: "systemConfig",
    moduleName: "ServiceNodeConfig",
    stores: ["ceptypes", "servicetypes", "operatortypes"],
  },
  {
    name: "openaigpt",
    API: "openaigpt",
    moduleName: "ServiceVercelAI",
    modelVersion: 'gpt-3.5-turbo-0613', // claimed to be more steerable 
    //modelVersion: 'gpt-4-0613', // Should understand functions
    //modelVersion: 'gpt-3.5-turbo-instruct', // a completion model (single-turn tasks)
    temperature: 1.0, // range of 0-2
    maxTokens: 4000,
    maxResponseTokens: 1000, // Leave space for context
    prePrompt: "",
    postPrompt: "",
    systemMessage:"",
    messages: [],
    forget: false,
    dummyAPI: false,
    prompt: "",
    useCache: true,
    noStreaming: false,
    systemMessageTemplate: "",
    cacheKeySeed: "",
    maxFunctionDepth: 1,
  },
  {
    name: "configchat",
    parentName: "openaigpt",
    systemMessage: `You are AI42, a large language model\nYou will help the user manage the configuration of T@skFlow (TF), a task processing system. A Task in this context is a JSON object that describes a unit of work or activity in a system. Each task object adheres to a schema, and contains various properties to describe its nature, configuration, state, and more. You are running inside the TF system and your chat interface with the user is itself a task. Your conversation is presented in a 'TaskConversation' tasktype and a child task of type 'TaskChat' manages interfactions between you, the user, and the system configuration. The user interface runs in a web browser that includes a TaskSystemMenu task that presents available tasks to the user.  
    
    Properties of the task object are accessed through a dot separated string representing the property path e.g. "task.user.id"
    
    The task object has the following paths:
    ceps: An object containing CEP configurations.
    command: A string indicating a command to execute. It could be null.
    commandArgs: An object containing arguments for the command.
    config.maxRequestCount, maxRequestRate: Rate limiting details.
    config.label: The display name for the task 
    config.nextTask: Flow control information.
    config.oneFamily: Collaboration settings.
    config.collaborateGroupId: Collaboration settings.
    config.spawnTask: Indicates if the task will spawn operators.
    services: An object containing service configurations.
    error: Information about any errors that may have occurred.
    familyId: String that helpz categorizing the task.
    groupId: String that associates permissions with the task.
    id: A unique dot separated identifier for the task configuration.
    instanceId: A unique identifier for this instance of the task configuration.
    meta.createdAt: An object with date and timezone keys referencing the time the task was created.
    meta.lastUpdatedAt: An object with date and timezone keys referencing the time the task was last updated.
    meta.parentId: The id of the parent task.
    name: A human-readable name for the task.
    operators: An object containing operator configurations.
    parentName: The name of the parent task, if any.
    permissions: An array of strings representing permissions.
    processor: An object detailing the processing unit for this task.
    shared: An object containing shared data.
    type: A string indicating the type of the task.
    user: An object containing user details.
    
    You have access to different T@skFlow configurations: 'tasks', 'tasktypes', 'users', 'groups'.
    tasks: initialisation values for tasks.
    tasktypes: the different types of tasks and default configuration values.
    users: individual users and their permissions.
    groups: the groups of users and their permissions.

    Functions are available to you for managing the TF configuration. 
    `,
    functions: [
      {
        name: 'create',
        description: 'Create a new configuration object',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            actionObject: { type: 'object', description: 'The object to create' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['targetConfig', 'actionObject', 'explanation'],
        },
      },
      /*
      {
        name: 'read',
        description: 'Returns the configuration object',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            id: { type: 'string', description: 'The id of the object to read' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['targetConfig', 'id', 'explanation'],
        },
      },
      */
      {
        name: 'update',
        description: 'Update an object',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            actionObject: { type: 'object', description: 'The object to update' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['targetConfig', 'actionObject', 'explanation'],
        },
      },
      {
        name: 'update_value',
        description: 'Set a value in a configuration object',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            id: { type: 'string', description: 'The dot separated id of the object' },
            path: { type: 'string', description: 'The path of the property. A dot separated path e.g. "meta.updatedAt"' },
            value: {
              anyOf: [
                { type: 'string' },
                { type: 'number' },
                { type: 'boolean' },
                { type: 'null' },
                { type: 'array', items: {} }, // Arrays can contain items of any type
                { type: 'object' }
              ],
              description: 'The new value to set at the property path'
            },
            valueType: { type: 'string', enum: ['string', 'number', 'boolean', 'null', 'array', 'object'], description: 'The type of value argument' },
            explanation: { type: 'string', description: 'A short explanation of why this function was called' },
          },
          required: ['targetConfig', 'id', 'path', 'value', 'valueType', 'explanation'],
        },
      },      
      {
        name: 'delete',
        description: 'Delete a configuration object and its children',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            id: { type: 'string', description: 'The dot separated id of the object to delete' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['targetConfig', 'id', 'explanation'],
        },
      },
      {
        name: 'insert',
        description: 'Insert a new configuration object',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            id: { type: 'string', description: 'The id where the new object should be inserted' },
            newObjectLabel: { type: 'string', description: 'Label for the new object' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['targetConfig', 'id', 'newObjectLabel', 'explanation'],
        },
      },
      {
        name: 'move',
        description: 'Move a configuration object',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            id: { type: 'string', description: 'The id of the object to move' },
            destinationId: { type: 'string', description: 'The id of the destination' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['targetConfig', 'id', 'destinationId', 'explanation'],
        },
      },
      {
        name: 'paste',
        description: 'Paste a configuration object',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            id: { type: 'string', description: 'The id of the object to paste' },
            newObjectLabel: { type: 'string', description: 'Label for the new object' },
            destinationId: { type: 'string', description: 'The id of the destination' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['targetConfig', 'id', 'newObjectLabel', 'destinationId', 'explanation'],
        },
      },
      /* // Too big
      {
        name: 'get_task',
        description: 'Get the object representing the current task',
        parameters: {
          type: 'object',
          properties: {
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['explanation'],
        },
      },
      */
      {
        name: 'get_task_paths',
        description: 'Get the paths in the current task',
        parameters: {
          type: 'object',
          properties: {
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['explanation'],
        },
      },
      {
        name: 'get_current_task_value',
        description: 'Get a value of the the current task object',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'The path of the property. A dot separated path e.g. "meta.createdAt"' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['path', 'explanation'],
        },
      },
      {
        name: 'get_task_value',
        description: 'Get a value from a task object',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The id of the task object' },
            path: { type: 'string', description: 'The path of the property. A dot separated path e.g. "config.useCache"' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['path', 'id', 'explanation'],
        },
      },
      
    ],
  },
  {
    name: "openaistub",
    API: "openaistub",
    moduleName: "ServiceVercelAI",
  },
  {
    name: "chatgpt",
    parentName: "openaigpt",
    label: "chatGPT",
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`,
    /* 
    messages: [
      {
        role: 'user',
        text: `When I amke a spelling mistake tell me.`,
      },
      {
        role: 'assistant',
        text: `OK. You made a spelling mistake: "amake" should be "make"`,
      },
    ],
    */
  },
  {
    name: "chatgptzeroshot",
    parentName: "openaigpt",
    label: "ChatGPT Zero Shot",
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`,
    forget: true,
  },
];

export { servicetypes }

