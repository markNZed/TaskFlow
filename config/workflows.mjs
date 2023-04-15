// Maybe multiple tasks to build a prompt instead of one task
// May want to specify token limits in the workflow tasks

import workflow_chatGPT from './workflow/chatGPT.mjs';

const workflows = {
    name: 'exercices',
    id: '1',
    children: [
         {
            name: 'conversation',
            id: '1.1',
            children: [
                workflow_chatGPT,
                {
                    name: "example",
                    id: '1.1.2',
                    // system_message: "something",
                    // model: "gpt-4"
                    // suggested_prompts: ["an example"]
                    tasks: {
                        start : {
                            response: "Hello",
                            id: '1.1.2.start',
                            name: 'start',
                            component: 'TaskShowResponse',
                            next: 'summarize'
                        },
                        summarize: {
                            agent: "chatgpt",
                            id: '1.1.2.summarize',
                            name: 'summarize',
                            instruction: "Tell the user what to do",
                            initialize: true, // Because the start has no prompt so does not initialize things in server
                            prompt: "Tell me a story about something random.",
                            component: 'TaskFromAgent',
                            input: '',
                            input_label: "Respond here.",
                            response: '', // From the agent
                            next: 'structure'
                        },
                        structure: {
                            agent: "chatgpt",
                            id: '1.1.2.structure',
                            name: 'structure',
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
                            //messages: []
                            next: 'stop',
                        },
                    }
                }, 
            ]             
        },
    ]
}

export { workflows };