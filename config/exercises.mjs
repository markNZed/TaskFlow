// Maybe multiple steps to build a prompt instead of one step
// May want to specify token limits in the exercise steps

const exercises = {
    name: 'exercices',
    id: '1',
    children: [
         {
            name: 'conversation',
            id: '1.1',
            children: [
                {
                    name: "chatGPT",
                    exercise: true,
                    conversation: true,
                    id: '1.1.1',
                    agent: 'chatgpt',
                    //default: true
                },        
                {
                    name: "example",
                    exercise: true,
                    id: '1.1.2',
                    steps: {
                        start : {
                            text: "Hello",
                            component: 'TaskShowText',
                            next: 'summarize'
                        },
                        summarize: {
                            agent: "chatgpt",
                            initialize: true, // Because the start has no prompt so does not initialize things in server
                            prompt: "Tell me a story about something random.",
                            component: 'TaskFromAgent',
                            input: '',
                            input_label: "Respond here.",
                            response: '',
                            next: 'structure'
                        },
                        structure: {
                            agent: "chatgpt",
                            component: 'TaskFromAgent',
                            initialize: true,
                            instruction: "This is what I think of your response",
                            assemble_prompt:  ["Provide feedback on this prompt, is it a good prompt? ", "\"", 'summarize.input', "\""],
                            messages_template: [
                                {
                                    role: 'user',
                                    content: ["This is a response from an earlier message", 'summarize.response']
                                },
                                {
                                    role: 'assistant',
                                    content: "OK. Thank you. What would you like me to do?"
                                }
                            ],
                            next: 'stop',
                        },
                    }
                }, 
            ]             
        },
    ]
}

export { exercises };