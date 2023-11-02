import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { configInitOne_async, users, groups, tasktypes, tasks, autoStartTasks } from "../src/configdata.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function writeConfigToFile(type) {
  const configDir = '../db/config';
  const configMap = {
    users,
    groups,
    tasktypes,
    tasks
  };

  if (!configMap[type]) {
    console.error(`Invalid configuration type: ${type}`);
    return;
  }

  try {
    await writeFile(join(__dirname, `${configDir}/${type}.json`), JSON.stringify(configMap[type], null, 2));
    if (type === "tasks") {
      await writeFile(join(__dirname, `${configDir}/autoStartTasks.json`), JSON.stringify(autoStartTasks, null, 2));
    }
    console.log(`The ${type} configuration file has been written successfully.`);
  } catch (error) {
    console.error(`An error occurred while writing the ${type} configuration file:`, error);
  }
}

// Get the configuration type from command-line arguments
const configType = process.argv[2];

console.log("configInitOne_async", configType);
await configInitOne_async(configType);
console.log("writeConfigToFile", configType);
writeConfigToFile(configType);
