const currentDate = new Date().toISOString().split("T")[0];

const servicetypes = [
  {
    name: "root",
  },
  {
    name: "openaigpt",
    base: 'gpt-3.5-turbo-0613', // claimed to be more steerable 
    temperature: 0,
    maxTokens: 4000,
    maxResponseTokens: 1000, // Leave space for context
    parentType: "root",
  },
  {
    name: "chatgpt",
    parentType: "openaigpt",
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
                text: `OK. You made a spelling mistake "amake" `,
            },
        ],
    */
  },
];
export { servicetypes };
