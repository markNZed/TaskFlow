const components = [
    {
        name: 'root',
        filter_for_client: [ // parameter names that will not be stripped from the Task when sent from the server to the client
            'id', 
            'component', 
            'component_depth',
            'next', 
            'forget', 
            'name', 
            'label', 
            'instanceId', 
            'threadId', 
            'children', 
            'done', 
            'steps', 
            'step', 
            'next_step',
            'menu', 
            'update_count',
        ],
    },
    {
        name: 'TaskChat',
        parent: 'root',
        menu: false,
        APPEND_filter_for_client: ['client_prompt', 'suggested_prompts', 'response'],
    },
    {
        name: 'TaskConversation',
        parent: 'root',
        APPEND_filter_for_client: ['welcome_message'],
        menu: false,
    },
    {
        name: 'TaskStepper',
        parent: 'root',
    },
    {
        name: 'TaskFromAgent',
        parent: 'root',
        APPEND_filter_for_client: ['response', 'input', 'input_label', 'instruction'],
    },
    {
        name: 'TaskShowResponse',
        parent: 'root',
        APPEND_filter_for_client: ['response'],
    },
    {
        name: 'TaskChoose',
        parent: 'root',
    },
]

export { components }