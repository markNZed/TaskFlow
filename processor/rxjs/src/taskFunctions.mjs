/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TASK_DIR } from "../config.mjs";

const taskFunctions = {};

// Here we are importing all the Task Functions
// It may be better to import the Tsak when it is needed

const importFunctions = async () => {
  let taskDir = path.dirname(fileURLToPath(import.meta.url));
  taskDir += "/" + TASK_DIR;
  const taskFiles = fs
    .readdirSync(taskDir)
    .filter((file) => file.startsWith("Task") && file.endsWith(".mjs"));

  const importPromises = taskFiles.map(async (file) => {
    const moduleName = path.basename(file, ".mjs");
    const modulePath = `./${TASK_DIR}/${file}`;
    //console.log("Importing " + moduleName)
    const module = await import(modulePath);
    taskFunctions[moduleName + "_async"] = module[moduleName + "_async"];
    //console.log("Imported " + moduleName)
  });

  await Promise.all(importPromises);
};

await importFunctions();

export { taskFunctions };
