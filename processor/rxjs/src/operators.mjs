import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Store the mapping of operator  names to their file paths
const operatorFilePaths = {};

const initializeOperatorFilePaths = () => {
  let operatorsDir = path.dirname(fileURLToPath(import.meta.url));
  operatorsDir += `/Operators`;
  const operatorFiles = fs
    .readdirSync(operatorsDir)
    .filter((file) => file.startsWith("Operator") && file.endsWith(".mjs"));

  operatorFiles.forEach((file) => {
    const modulename = path.basename(file, ".mjs");
    const modulePath = `./Operators/${file}`;
    operatorFilePaths[modulename] = modulePath;
  });
};

// Initialize the operator file paths
initializeOperatorFilePaths();
console.log("operatorFilePaths", operatorFilePaths);

const importOperator_async = async (name) => {
  if (!operatorFilePaths[name]) {
    console.log("operatorFilePaths:", operatorFilePaths);
    throw new Error(`Operator ${name} does not exist.`);
  }
  
  const modulePath = operatorFilePaths[name];
  //console.log("importOperator_async " + name)
  const module = await import(modulePath);
  //console.log("importOperator_async module", module[name]);
  return module[name];
};

const operatorExists_async = async (name) => {
  if (!operatorFilePaths[name]) {
    return false;
  }
  return true;
}

export { importOperator_async, operatorExists_async };
