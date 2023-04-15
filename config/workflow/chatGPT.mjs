const workflow_chatGPT = {
    name: "chatGPT",
    kernel: 'chat',
    id: '1.1.1',
    agent: 'chatgpt',
    tasks: {
        chat : {
            name: 'chat',
            id: '1.1.1.chat',
            component: 'TaskChat',
            next: 'chat'
        },
    },
    //default: false
    //one_session : false
    //use_cache: true

}     

export default workflow_chatGPT;