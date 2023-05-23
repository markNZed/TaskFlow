/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const taskFunctions = {};

const importFunctions = async () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const taskFiles = fs
    .readdirSync(currentDir)
    .filter((file) => file.startsWith("Task") && file.endsWith(".mjs"));

  const importPromises = taskFiles.map(async (file) => {
    const moduleName = path.basename(file, ".mjs");
    const modulePath = `./${file}`;
    console.log("Importing " + moduleName)
    const module = await import(modulePath);
    taskFunctions[moduleName + "_async"] = module[moduleName + "_async"];
    console.log("Imported " + moduleName)
  });

  await Promise.all(importPromises);
};

await importFunctions();

export { taskFunctions };
