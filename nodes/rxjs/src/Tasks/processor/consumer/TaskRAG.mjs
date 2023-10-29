/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import fs from 'fs';
import path from 'path';
import { NODE } from "#root/config";

// eslint-disable-next-line no-unused-vars
const TaskRAG_async = async function (wsSendTask, T, FSMHolder) {

    if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

    const corpusDir = path.join(NODE.storage.dataDir, "RAG", T("config.local.corpusName"));
    const metadataDir = path.join(corpusDir, 'metadata');
    const topicsFile = "taskflow-topics.json"; // Should be shared with TaskRAGProcessing
    const topicsFilePath = path.join(metadataDir, topicsFile);

    async function getTopics(topicsFilePath) {
        const fileContent = await fs.promises.readFile(topicsFilePath, 'utf-8');
        const topics = JSON.parse(fileContent); // Parse the JSON content
        return topics;
    }

    switch (T("state.current")) {
        case "start": {
          const topics = await getTopics(topicsFilePath);
          let topicOptions = []
          for (let i = 0; i < topics.length; i++) {
            const option = topics[i];
            topicOptions.push({ value: option, label: option });
          }
          T("output.select.config.local.fields.topic.options", topicOptions);
          T("output.config.local.corpusName", T("config.local.corpusName"));
          T("output.config.local.user", T("config.local.user"));
          T("config.local.topics", topics);
          T("state.current", "loaded");
          T("command", "update");
          T("commandDescription", "Loaded the topics into config");
          console.log("TaskRAG_async", topics);
          break;
        }
        case "loaded":
          break;
        default:
          console.log("WARNING unknown state : " + T("state.current"));
          return null;
      }
    
  
    return null;
  };
  
  export { TaskRAG_async };
  