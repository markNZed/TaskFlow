const workflow_chatGPT = {
    name: "chatgpt",
    label: "chatGPT",
    parent: 'conversation',
    agent: 'chatgpt',
    tasks: {
        start : {
            component: 'TaskChat',
            ui_task: 'TaskConversation',
            next: 'start'
        },
    },
    //default: false,
    //one_thread : false,
    //use_cache: true,
}     

export default workflow_chatGPT;