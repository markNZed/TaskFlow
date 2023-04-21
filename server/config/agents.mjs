const currentDate = new Date().toISOString().split('T')[0]

const agents = {
    chatgpt: {
        name: "chatGPT",
        system_message: `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`,
        /* 
        dyad: true,
        messages: [
            {
                role: 'user',
                content: `When I amke a spelling mistake tell me.`,
            },
            {
                role: 'assistant',
                content: `OK. You made a spelling mistake "amake" `,
            },
        ],
        */
    },
}
export { agents };