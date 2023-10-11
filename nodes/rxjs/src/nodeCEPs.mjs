import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Store the mapping of cep  names to their file paths
const cepFilePaths = {};

const initializeCEPFilePaths = () => {
  let cepsDir = path.dirname(fileURLToPath(import.meta.url));
  cepsDir += `/CEPs`;
  const cepFiles = fs
    .readdirSync(cepsDir)
    .filter((file) => file.startsWith("CEP") && file.endsWith(".mjs"));
  cepFiles.forEach((file) => {
    const modulename = path.basename(file, ".mjs");
    const modulePath = `./CEPs/${file}`;
    cepFilePaths[modulename] = modulePath;
  });
};

// Initialize the cep file paths
initializeCEPFilePaths();
console.log("cepFilePaths", cepFilePaths);

const importCEP_async = async (name) => {
  if (!cepFilePaths[name]) {
    console.log("cepFilePaths:", cepFilePaths);
    throw new Error(`CEP ${name} does not exist.`);
  }
  const modulePath = cepFilePaths[name];
  //console.log("importCEP_async " + name)
  const module = await import(modulePath);
  //console.log("importCEP_async module", module);
  return module[name];
};

const CEPExists_async = async (name) => {
  if (!cepFilePaths[name]) {
    return false;
  }
  return true;
}

export { importCEP_async, CEPExists_async };
