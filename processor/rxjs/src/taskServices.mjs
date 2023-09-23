import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const taskServices = {};
let taskServicesInitialized;  // Promise that will resolve when taskServices is fully initialized

const importFunctions = async () => {
  let servicesDir = path.dirname(fileURLToPath(import.meta.url));
  servicesDir += `/Services`;
  
  try {
    const serviceFiles = fs
      .readdirSync(servicesDir)
      .filter((file) => file.startsWith("Service") && file.endsWith(".mjs"));

    const importPromises = serviceFiles.map(async (file) => {
      const moduleName = path.basename(file, ".mjs");
      const modulePath = `${servicesDir}/${file}`;
      const module = await import(modulePath);
      taskServices[moduleName] = module[moduleName];
    });

    await Promise.all(importPromises);
  } catch (err) {
    console.error('An error occurred during initialization:', err);
  }
};

taskServicesInitialized = importFunctions();  // Initialize and store the promise

export { taskServices, taskServicesInitialized };
