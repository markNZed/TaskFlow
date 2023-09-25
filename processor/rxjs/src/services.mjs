import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Store the mapping of service  names to their file paths
const serviceFilePaths = {};

const initializeServiceFilePaths = () => {
  let servicesDir = path.dirname(fileURLToPath(import.meta.url));
  servicesDir += `/Services`;
  const serviceFiles = fs
    .readdirSync(servicesDir)
    .filter((file) => file.startsWith("Service") && file.endsWith(".mjs"));

  serviceFiles.forEach((file) => {
    const modulename = path.basename(file, ".mjs");
    const modulePath = `./Services/${file}`;
    serviceFilePaths[modulename] = modulePath;
  });
};

// Initialize the service file paths
initializeServiceFilePaths();
console.log("serviceFilePaths", serviceFilePaths);

const importService_async = async (name) => {
  if (!serviceFilePaths[name]) {
    console.log("serviceFilePaths:", serviceFilePaths);
    throw new Error(`Service  ${name} does not exist.`);
  }
  
  const modulePath = serviceFilePaths[name];
  const module = await import(modulePath);
  //console.log("importService_async module", module);
  return module[name];
};

const serviceExists_async = async (name) => {
  if (!serviceFilePaths[name]) {
    return false;
  }
  return true;
}

export { importService_async, serviceExists_async };
