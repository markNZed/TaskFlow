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
                },        
            ]
        },
    ]
}

export { exercises };