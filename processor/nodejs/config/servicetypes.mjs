const currentDate = new Date().toISOString().split("T")[0];

const servicetypes = [
  {
    name: "vercel",
    API: "openaigpt",
    moduleName: "ServiceVercelAI",
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
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`,
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
    parentName: "openaigpt",
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
    parentName: "openaigpt",
    label: "ChatGPT Zero Shot",
    systemMessage: `You are ChatGPT, a large language model trained by OpenAI. Answer as concisely as possible.\nKnowledge cutoff: 2021-09-01\nCurrent date: ${currentDate}`,
    forget: true,
  },
];
export { servicetypes };
