// This is an array because we use the same structure as other configdata
const operatortypes = [
  {
    name: "LLM",
    moduleName: "OperatorLLM",
    environments: ["rxjs-processor-consumer"],
  },
  {
    name: "RAG",
    moduleName: "OperatorRAG",
    environments: ["rxjs-processor-consumer"],
  },
];

export { operatortypes }

