
//NODE_NAME=processor-consumer ./nodes/rxjs/scripts/runFunction.js ./runFunctionTaskRAG.mjs
export function newTask(NODE, state, taskFunctionName) {
  taskFunctionName = 'TaskRAG';
  state = "debug";
  return {
    id: "runFunction." + taskFunctionName,
    instance: "runFunction-" + taskFunctionName,
    config: {
      local: {
        corpusName: "SG",
      },
    },
    type: taskFunctionName,
    environments: ["rxjs-" + NODE.name],
    state: {
      current: state,
    },
    input: {
      query: "vite",
    },
    operators: {
      LLM: {
        environments: ["rxjs-processor-consumer"],
      },
    },
    services: {
      chat: {
        type: "openaigpt.rag-gb",
        environments: ["rxjs-processor-consumer"],
      },
    },
  };
}