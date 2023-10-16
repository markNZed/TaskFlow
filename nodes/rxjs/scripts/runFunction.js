#!/usr/bin/env node
import { argv } from 'process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Example of use: run TaskRAGPreprocessing as the processor-consumer Node in the "parse" state
// ./runFunctionTask.mjs is relative to the script location and provides newTask() which returns a Task configuration
// NODE_NAME=processor-consumer ./nodes/rxjs/scripts/runFunction.js ./runFunctionTask.mjs TaskRAGPreprocessing parse

async function main() {
  if (argv.length < 2) {
    console.error('Usage: node script.mjs taskFunctionName state');
    process.exit(1);
  }

  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = dirname(scriptPath);

  try {

    // Change the current working directory to its parent directory
    // This is where the server would run from
    process.chdir(join(scriptDir, '/..'));

    // This is an import path so rlative to the location of the script
    const runFunctionTask = argv[2] || './runFunctionTask.mjs';

    // Dynamically import the module after changing the directory
    const { NODE } = await import('../config.mjs');
    const { nodeTasks_async } = await import('../src/nodeTasks.mjs');
    const { newTask } = await import(runFunctionTask);

    // Extract the module name from the provided path
    let taskFunctionName = argv[3];
    const state = argv[4] || "start";

    var CEPMatchMap = new Map();

    // eslint-disable-next-line no-unused-vars
    const wsSendTask  = async (task) => {
      //console.log("wsSendTask:", JSON.stringify(task, null, 2));
    }

    const task = newTask(NODE, state, taskFunctionName);

    if (!taskFunctionName) {
      taskFunctionName = task.type;
    }

    const result = await nodeTasks_async(wsSendTask, task, CEPMatchMap);
    console.log("Result:", JSON.stringify(result, null, 2));

    // Exit the script with a success exit code (0)
    process.exit(0);
    
  } catch (error) {
    console.error(`Error loading or running : ${error}`);
    process.exit(1);
  }
}

main();


