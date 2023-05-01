export function fromV00toV01(taskV00) {
    let taskV01 = taskV00
    return taskV01
}

export function fromV01toV00(taskV01) {
    let taskV00 = taskV01
    return taskV00
}


export function fromV00toV01_gpt4(taskV00) {
    let taskV01 = {
        config: {
            instruction: taskV00.instruction,
            messagesTemplate: taskV00.messages_template.map(message => {
                return {
                    content: message.content,
                    role: message.role
                };
            }),
            nextStates: taskV00.steps,
            promptTemplate: taskV00.assemble_prompt,
            suggestedPrompts: taskV00.suggested_prompts,
            welcomeMessage: taskV00.welcome_message
        },
        input: {}, // assuming you want to initialize it as an empty object
        meta: {
            baseType: "", // assuming you want to initialize it as an empty string
            children: taskV00.children,
            completedAt: "", // assuming you want to initialize it as an empty string
            createdAt: taskV00.created,
            dependencies: [], // assuming you want to initialize it as an empty array
            error: null, // assuming you want to initialize it as null
            permissions: taskV00.groups,
            id: taskV00.id,
            initiator: taskV00.menu,
            name: taskV00.name,
            nextTasks: [], // assuming you want to initialize it as an empty array
            parentId: taskV00.parentId,
            parentType: "", // assuming you want to initialize it as an empty string
            send: "", // assuming you want to initialize it as an empty string
            stack: [], // assuming you want to initialize it as an empty array
            stackPtr: 0, // assuming you want to initialize it as 0
            threadId: taskV00.threadId,
            type: "", // assuming you want to initialize it as an empty string
            updateCount: taskV00.update_count,
            updatedAt: taskV00.last_change,
            userId: taskV00.userId,
            versionExternal: "0.2", // assuming you want to initialize it as an empty string
            versionInternal: "0.0" // assuming you want to initialize it as an empty string
        },
        output: {}, // assuming you want to initialize it as an empty object
        privacy: {}, // assuming you want to initialize it as an empty object
        request: {
            agent: taskV00.agent,
            forget: taskV00.forget,
            inputLabel: taskV00.input_label,
            messages: taskV00.messages.map(message => {
                return {
                    content: message.content,
                    role: message.role
                };
            }),
            model: "", // assuming you want to initialize it as an empty string
            prompt: taskV00.prompt,
            temperature: 0, // assuming you want to initialize it as 0
        },
        response: {
            text: taskV00.response,
            userInput: taskV00.input
        },
        state: {
            current: taskV00.step,
            deltaState: taskV00.delta_step,
            done: taskV00.done,
            id: "", // assuming you want to initialize it as an empty string
            nextState: taskV00.next_step,
            sessionId: taskV00.sessionId
        }
    };
    return taskV01;
}

export function fromV01toV00_gpt4(taskV01) {
    let taskV00 = {
        agent: taskV01.request.agent,
        assemble_prompt: taskV01.config.promptTemplate,
        children: taskV01.meta.children,
        created: taskV01.meta.createdAt,
        delta_step: taskV01.state.deltaState,
        done: taskV01.state.done,
        forget: taskV01.request.forget,
        groups: taskV01.meta.permissions,
        menu: taskV00.meta.initiator,
        id: taskV01.meta.id,
        input: taskV01.response.userInput,
        input_label: taskV01.request.inputLabel,
        instruction: taskV01.config.instruction,
        last_change: taskV01.meta.updatedAt,
        messages: taskV01.request.messages.map(message => {
            return {
                content: message.content,
                role: message.role
            };
        }),
        messages_template: taskV01.config.messagesTemplate.map(message => {
            return {
                content: message.content,
                role: message.role
            };
        }),
        name: taskV01.meta.name,
        next_step: taskV01.state.nextState,
        parentId: taskV01.meta.parentId,
        prompt: taskV01.request.prompt,
        response: taskV01.response.text,
        step: taskV01.state.current,
        steps: taskV01.config.nextStates,
        suggested_prompts: taskV01.config.suggestedPrompts,
        threadId: taskV01.meta.threadId,
        update_count: taskV01.meta.updateCount,
        userId: taskV01.meta.userId,
        welcome_message: taskV01.config.welcomeMessage
    };
    return taskV00;
}
