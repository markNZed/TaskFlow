#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/*
  This script is used to run a function from a specified JavaScript module with optional arguments for task type and state.

  Arguments:
  --taskFunctionName (optional): The name of the function to run.
  --runFunctionTask (optional): Path to the JS module that defines the function. Defaults to './runFunction/Task.mjs'.
  --state (optional): State argument that is forwarded to the function. Defaults to 'start'.

  Usage:
  node script.mjs --taskFunctionName=<functionName> [--runFunctionTask=<modulePath>] [--state=<state>]

  Examples:
  1. Run 'TaskRAGPreprocessing' function from the default module in the 'start' state:
     NODE_NAME=processor-consumer runFunction.js --taskFunctionName=TaskRAGPreprocessing

  2. Run 'TaskRAGPreprocessing' function in the 'debug' state:
     NODE_NAME=processor-consumer runFunction.js --runFunctionTask=TaskRAGPreprocessing.mjs --state=debug
*/

// Function to parse named arguments
function parseNamedArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value;
    }
  });
  return args;
}

async function main() {
  const args = parseNamedArgs();

  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = dirname(scriptPath);
  const FunctionDir = join(dirname(scriptPath), "runFunction");

  process.on('SIGINT', () => {
    console.log('Received SIGINT. Exiting...');
    process.exit(0);
  });

  try {
    process.chdir(join(scriptDir, '/..'));

    let runFunctionTask = args.runFunctionTask ? join(FunctionDir, args.runFunctionTask) : join(FunctionDir, 'Task.mjs');

    const { NODE } = await import('../config.mjs');
    const { nodeTasks_async } = await import('../src/nodeTasks.mjs');
    const { newTask } = await import(runFunctionTask);

    let taskFunctionName = args.taskFunctionName;
    const state = args.state || "start";

    var CEPMatchMap = new Map();

    // eslint-disable-next-line no-unused-vars
    const wsSendTask  = async (task) => {
      //console.log("wsSendTask:", JSON.stringify(task, null, 2));
    }

    const task = newTask(NODE, state, taskFunctionName);

    console.log("Task:", JSON.stringify(task, null, 2));

    const result = await nodeTasks_async(wsSendTask, task, CEPMatchMap);
    console.log("Result output:", JSON.stringify(result.output, null, 2));

    process.exit(0);
    
  } catch (error) {
    console.error(`Error loading or running : ${error}`);
    process.exit(1);
  }
}

main();
