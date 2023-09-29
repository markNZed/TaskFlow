import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NODE } from "../config.mjs";

// Store the mapping of task function names to their file paths
const taskFilePaths = {};

const setTaskFilePaths = (taskBaseDir, taskRelDir) => {
  let taskDir = path.join(taskBaseDir, taskRelDir);
  const taskFiles = fs
    .readdirSync(taskDir, { withFileTypes: true })
    .filter(
      (dirent) =>
        dirent.isFile() &&
        dirent.name.startsWith("Task") &&
        dirent.name.endsWith(".mjs")
    )
    .map((dirent) => dirent.name);

  taskFiles.forEach((file) => {
    const moduleName = path.basename(file, ".mjs");
    const modulePath = "./" + taskRelDir + "/" + file;
    taskFilePaths[moduleName + "_async"] = modulePath;
  });
};


const initializeTaskFilePaths = () => {
  const taskBaseDir = path.dirname(fileURLToPath(import.meta.url));
  let taskRelDir = `Tasks/${NODE.type}/${NODE.role}`;
  setTaskFilePaths(taskBaseDir,taskRelDir);
  taskRelDir = `Tasks/${NODE.type}`;
  setTaskFilePaths(taskBaseDir,taskRelDir);
  taskRelDir = `Tasks`;
  setTaskFilePaths(taskBaseDir,taskRelDir);
  console.log("taskFilePaths:", taskFilePaths);
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
