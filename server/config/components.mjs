const workflow_components = [
    {
        name: 'components',
        parent: 'root',
        menu: false,
    },
    {
        name: 'TaskChat',
        parent: 'components',
        menu: false,
        APPEND_filter_for_client: ['client_prompt', 'suggested_prompts', 'response'],
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'TaskConversation',
        parent: 'components',
        APPEND_filter_for_client: ['welcome_message'],
        menu: false,
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'TaskStepper',
        parent: 'components',
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'TaskFromAgent',
        parent: 'components',
        APPEND_filter_for_client: ['response', 'input', 'input_label', 'instruction'],
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'TaskShowResponse',
        parent: 'components',
        APPEND_filter_for_client: ['response'],
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'TaskChoose',
        parent: 'components',
    },
]
export default workflow_components