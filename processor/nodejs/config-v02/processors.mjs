const processors = [
  {
    name: "root"
  },
  {
    name: "react",
    parentType: "root",
    websocket: true,
    environments: ["react"],
  },
  {
    name: "nodejs",
    parentType: "root",
    websocket: true,
    environments: ["nodejs"],
  },
];

export { processors };