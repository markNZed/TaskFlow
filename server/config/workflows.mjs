import workflow_components from './components.mjs';
import workflow_chatGPT from './workflow/chatGPT.mjs';

const workflows_array = [
    {
        name: 'root',
        filter_for_client: [ // parameter names that will not be stripped from the Task when sent from the server to the client
            'id', 
            'component', 
            'next', 
            'forget', 
            'name', 
            'label', 
            'instanceId', 
            'threadId', 
            'children', 
            'done', 
            'steps', 
            'step', 
            'menu', 
            'ui_task', 
            'ui',
            'update_count',
        ],
        menu: false,
        //default: false,
        //one_thread : false,
        //use_cache: true,
    },
    {
        name: 'exercices',
        parent: 'root',
        menu: true,
    },
    {    
        name: 'conversation',
        parent: 'exercices',
    },
    workflow_chatGPT,
    {    
        name: 'workflow',
        parent: 'exercices',
    },
    {
        name: "example",
        parent: 'workflow',
        // system_message: "something",
        // model: "gpt-4"
        // suggested_prompts: ["an example"]
        // groups: [],
        tasks: {
            start : {
                response: "Hello",
                component: 'TaskShowResponse',
                ui_task: 'TaskStepper',
                next: 'summarize'
            },
            summarize: {
                agent: "chatgpt",
                instruction: "Tell the user what to do",
                forget: true, // Because the start has no prompt so does not forget things in server
                prompt: "Tell me a story about something random.",
                component: 'TaskFromAgent',
                input: '',
                input_label: "Respond here.",
                response: '', // From the agent
                next: 'structure'
            },
            structure: {
                agent: "chatgpt",
                component: 'TaskFromAgent',
                forget: true,
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

// Importing arrays of workflows
const workflows = [...workflows_array, ...workflow_components];

export { workflows };