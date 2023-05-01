export function fromV01toV02(taskV01) {
    let taskV02 = taskV01
    return taskV02
}

export function fromV02toV01(taskV02) {
    let taskV01 = taskV02
    return taskV01
}

export function fromV01toV02_gpt4(taskV01) {
    let taskV02 = {
        config: {
            instruction: taskV01.instruction,
            messagesTemplate: taskV01.messages_template.map(message => {
                return {
                    content: message.content,
                    role: message.role
                };
            }),
            nextStates: taskV01.steps,
            promptTemplate: taskV01.assemble_prompt,
            suggestedPrompts: taskV01.suggested_prompts,
            welcomeMessage: taskV01.welcome_message
        },
        input: {}, // assuming you want to initialize it as an empty object
        meta: {
            baseType: "", // assuming you want to initialize it as an empty string
            children: taskV01.children,
            completedAt: "", // assuming you want to initialize it as an empty string
            createdAt: taskV01.created,
            dependencies: [], // assuming you want to initialize it as an empty array
            error: null, // assuming you want to initialize it as null
            permissions: taskV01.groups,
            id: taskV01.id,
            initiator: taskV01.menu,
            name: taskV01.name,
            nextTasks: [], // assuming you want to initialize it as an empty array
            parentId: taskV01.parentId,
            parentType: "", // assuming you want to initialize it as an empty string
            send: "", // assuming you want to initialize it as an empty string
            stack: [], // assuming you want to initialize it as an empty array
            stackPtr: 0, // assuming you want to initialize it as 0
            threadId: taskV01.threadId,
            type: "", // assuming you want to initialize it as an empty string
            updateCount: taskV01.update_count,
            updatedAt: taskV01.last_change,
            userId: taskV01.userId,
            versionExternal: "0.2", // assuming you want to initialize it as an empty string
            versionInternal: "0.0" // assuming you want to initialize it as an empty string
        },
        output: {}, // assuming you want to initialize it as an empty object
        privacy: {}, // assuming you want to initialize it as an empty object
        request: {
            agent: taskV01.agent,
            forget: taskV01.forget,
            inputLabel: taskV01.input_label,
            messages: taskV01.messages.map(message => {
                return {
                    content: message.content,
                    role: message.role
                };
            }),
            model: "", // assuming you want to initialize it as an empty string
            prompt: taskV01.prompt,
            temperature: 0, // assuming you want to initialize it as 0
        },
        response: {
            text: taskV01.response,
            userInput: taskV01.input
        },
        state: {
            current: taskV01.step,
            deltaState: taskV01.delta_step,
            done: taskV01.done,
            id: "", // assuming you want to initialize it as an empty string
            nextState: taskV01.next_step,
            sessionId: taskV01.sessionId
        }
    };
    return taskV02;
}

export function fromV02toV01_gpt4(taskV02) {
    let taskV01 = {
        agent: taskV02.request.agent,
        assemble_prompt: taskV02.config.promptTemplate,
        children: taskV02.meta.children,
        created: taskV02.meta.createdAt,
        delta_step: taskV02.state.deltaState,
        done: taskV02.state.done,
        forget: taskV02.request.forget,
        groups: taskV02.meta.permissions,
        menu: taskV01.meta.initiator,
        id: taskV02.meta.id,
        input: taskV02.response.userInput,
        input_label: taskV02.request.inputLabel,
        instruction: taskV02.config.instruction,
        last_change: taskV02.meta.updatedAt,
        messages: taskV02.request.messages.map(message => {
            return {
                content: message.content,
                role: message.role
            };
        }),
        messages_template: taskV02.config.messagesTemplate.map(message => {
            return {
                content: message.content,
                role: message.role
            };
        }),
        name: taskV02.meta.name,
        next_step: taskV02.state.nextState,
        parentId: taskV02.meta.parentId,
        prompt: taskV02.request.prompt,
        response: taskV02.response.text,
        step: taskV02.state.current,
        steps: taskV02.config.nextStates,
        suggested_prompts: taskV02.config.suggestedPrompts,
        threadId: taskV02.meta.threadId,
        update_count: taskV02.meta.updateCount,
        userId: taskV02.meta.userId,
        welcome_message: taskV02.config.welcomeMessage
    };
    return taskV01;
}
