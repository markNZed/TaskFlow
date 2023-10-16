export function newTask(NODE, state, taskFunctionName) {
    return {
      id: "runFunction." + taskFunctionName,
      instance: "runFunction-" + taskFunctionName,
      config: {
        local: {
          corpusDir: '/app/data/rag/corpus',
        },
      },
      type: taskFunctionName,
      environments: ["rxjs-" + NODE.name],
      state: {
        current: state,
      },
    };
  }