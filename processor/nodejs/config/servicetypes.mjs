const currentDate = new Date().toISOString().split("T")[0];

const servicetypes = [
  {
    name: "vercel",
    API: "openaigpt",
    moduleName: "ServiceVercelAI",
    modelVersion: 'gpt-3.5-turbo-0613', // claimed to be more steerable 
    //modelVersion: 'gpt-4-0613', // Should understand functions
    temperature: 0,
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
  },
  {
    name: "configchat",
    parentName: "vercel",
    systemMessage: `You are AI42, a large language model with knowledge cutoff at 2021-09-01\nCurrent date is ${currentDate}\nYou help the user to manage the configuration of T@skFlow (TF), a task processing system. A Task in this context is an object that describes a particular unit of work or activity in a system. Each task object adheres to a JSON schema, and contains various properties to describe its nature, configuration, state, and more. Be as efficient and concise as possible in your responses.

    Here are the essential properties of a Task:
    
        command: A string indicating a command to execute. It could be null.
        commandArgs: An object containing arguments for the command.
        error: Information about any errors that may have occurred.
        familyId & groupId: Strings that help in categorizing the task.
        id: A unique dot separated identifier for the task configuration.
        instanceId: A unique identifier for this instance of the task configuration.
        name: A human-readable name for the task.
        parentName: The name of the parent task, if any.
        permissions: An array of strings representing permissions.
        processor: An object detailing the processing unit for this task.
        type: A string indicating the type of the task.
        user: An object containing user details.
        versionExternal & versionInternal: Versioning information.
    
    Additionally, the task object has a config property, which can include:
    
        maxRequestCount, maxRequestRate: Rate limiting details.
        label: The display name for the task 
        nextTask: Flow control information.
        oneFamily, collaborateGroupId: Collaboration settings.
        spawnTask: Indicates if the task will spawn subtasks.
        services: An object containing service configurations.

    Also, the task object has a meta property, which can include:

        createdAt: An object with date and timezone keys referencing the time the task was created.
        lastUpdatedAt: An object with date and timezone keys referencing the time the task was last updated.
        parentId: The id of the parent task.

    The task.shared.tasksConfigTree holds an object that represents the tasks configuration hierarchy.

    Finally, the object also links to external definitions like Privacy, Input, Meta, Output, Config, etc., that further describe the task.
    
    You have access to different configurations. Configuration can have a tree like structure represented by a dot separated id that is unique.
        tasks: objects repreenitng different initialisation values for task.
        tasktypes: objects representing the different types of tasks and default configuration values.
        users: objects representing individual users and their permissions.
        groups: objects representing the groups of users and their permissions.

    Instead of getting the current value of a property and then updating it, you can directly update the value without retrieving the current value beforehand. This approach can be more efficient and concise.
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
            id: { type: 'string', description: 'The id of the object' },
            path: { type: 'string', description: 'The path of the property. A dot separated path e.g. "meta.updatedAt"' },
            value: { type: 'string', description: 'The new value to set at the property path' },
            explanation: { type: "string", description: "A short explanation of why this function was called"},
          },
          required: ['targetConfig', 'id', 'path', 'value', 'explanation'],
        },
      },
      {
        name: 'delete',
        description: 'Delete a configuration object and its children',
        parameters: {
          type: 'object',
          properties: {
            targetConfig: { type: 'string', enum: ['tasks', 'tasktypes', 'users', 'groups'], description: 'The target configuration' },
            id: { type: 'string', description: 'The id of the object to delete' },
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
        description: 'Get a value from the the current task object',
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
        description: 'Get a value from the the current task object',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The id of the object to paste' },
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
    moduleName: "ServiceOpenAIGPT",
  },
  {
    name: "openaigpt",
    API: "openaigpt",
    moduleName: "ServiceOpenAIGPT",
    modelVersion: 'gpt-3.5-turbo-0613', // claimed to be more steerable 
    temperature: 0,
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
  },
  {
    name: "chatgpt",
    parentName: "vercel",
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
    parentName: "vercel",
    label: "ChatGPT Zero Shot",
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`,
    forget: true,
  },
];
export { servicetypes };
