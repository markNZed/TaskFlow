import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NODE } from "../config.mjs";

// Store the mapping of task function names to their file paths
const taskFilePaths = {};

const initializeTaskFilePaths = () => {
  let taskDir = path.dirname(fileURLToPath(import.meta.url));
  taskDir += "/" + `Tasks/${NODE.type}/${NODE.role}`;
  const taskFiles = fs
    .readdirSync(taskDir)
    .filter((file) => file.startsWith("Task") && file.endsWith(".mjs"));

  taskFiles.forEach((file) => {
    const moduleName = path.basename(file, ".mjs");
    const modulePath = `./Tasks/${NODE.type}/${NODE.role}/${file}`;
    taskFilePaths[moduleName + "_async"] = modulePath;
  });
};

// Initialize the task file paths
initializeTaskFilePaths();

const importTaskFunction_async = async (functionName) => {
  if (!taskFilePaths[functionName]) {
    console.log("taskFilePaths:", taskFilePaths);
    throw new Error(`Task function ${functionName} does not exist.`);
  }
  
  const modulePath = taskFilePaths[functionName];
  const module = await import(modulePath);
  return module[functionName];
};

const taskFunctionExists_async = async (functionName) => {
  if (!taskFilePaths[functionName]) {
    return false;
  }
  return true;
}

export { importTaskFunction_async, taskFunctionExists_async };
