const workflow_tasks = [
    {
        name: 'ui',
        parent: 'root',
        menu: false,
        ui: true,
    },
    {
        name: 'TaskChat',
        parent: 'ui',
        menu: false,
        APPEND_filter_for_client: ['client_prompt'],
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'TaskConversation',
        parent: 'ui',
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
        parent: 'ui',
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'TaskFromAgent',
        parent: 'ui',
        APPEND_filter_for_client: ['response', 'input', 'input_label', 'instruction'],
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'TaskShowResponse',
        parent: 'ui',
        APPEND_filter_for_client: ['response'],
        tasks: {
            start : {
                next: 'stop',
            },
        },
    },
    {
        name: 'logic',
        parent: 'root',
        menu: false,
        ui: false,
    },
    {
        name: 'TaskChoose',
        parent: 'logic',
    },
]

export default workflow_tasks