export function newTask(NODE, state, taskFunctionName) {
    return {
      id: "runFunction." + taskFunctionName,
      instance: "runFunction-" + taskFunctionName,
      config: {
        corpusName: "FLE",
        local: {
        },
      },
      type: taskFunctionName,
      environments: ["rxjs-" + NODE.name],
      state: {
        current: state,
      },
    };
  }