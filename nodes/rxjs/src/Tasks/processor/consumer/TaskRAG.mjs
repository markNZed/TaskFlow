/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import weaviate from 'weaviate-ts-client';
import { utils } from '#src/utils';
import OpenAI from "openai";
import { NODE } from "#root/config";

/*
curl -X POST "http://weaviate:8080/v1/graphql" -H "Content-Type: application/json" -d '{
  "query": "{Aggregate {PDF {meta {count}}}}"
}'

Enhanced Generation:

    Conditional generation: Tailor the generation based on the context. For example, if a user asks a fact-based question, the answer should be concise. For more open-ended questions, it might be preferable to have a more detailed response.
    Diverse outputs: Use techniques like beam search, top-k sampling, or nucleus sampling to generate diverse and high-quality answers.
    Feedback loop: Implement a feedback system where users can rate or correct the generated responses, which can then be used to improve the generation model further.

*/

// eslint-disable-next-line no-unused-vars
const TaskRAG_async = async function (wsSendTask, T, FSMHolder) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  const operators = T("operators");
  const operatorRAG = operators["RAG"].module;

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const configuration = {
    apiKey: OPENAI_API_KEY,
  };
  const openai = new OpenAI(configuration);

  async function embedText_async(inputText) {
    try {
      var result = "";
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: inputText,
      });
      result = response["data"][0]["embedding"];
      return result;
    } catch (error) {
      console.error(error);
    }
  }

  const weaviateClient = weaviate.client({
    scheme: NODE.storage.weaviateScheme,
    host: NODE.storage.weaviateHost,
  });

  const className = T("config.local.corpusName");
  let queryVector;

  let nextState = T("state.current");
  const CACHE_ID = "TASKFLOW CACHE";

  while (!T("command") && nextState) {
    T("state.current", nextState);
    nextState = null;
    switch (T("state.current")) {
      case "start":
        break;
      case "input":
        break;
      case "sent": {
        await operatorRAG.operate_async(wsSendTask, T());
        console.log("Response from TaskRAG", T("response"));
        T("state.current", "response");
        T("command", "update");
        break;
      }
      case "response":
        // Store response to the DB
        // Should only do this if we are not already using the cache
        if (T("response.retrieved")) {
          queryVector = await embedText_async(T("response.query"));
          await weaviateClient.data
            .creator()
            .withClassName(className)
            .withProperties({
              title: CACHE_ID,
              text: T("response.result"),
              tokenLength: utils.stringTokens(T("response.result")),
              query: T("response.query"),
            })
            .withVector(queryVector)
            .do();
          console.log("Stored result for query", T("response.query"));
        }
        break;
      default:
        console.log("WARNING unknown state : " + T("state.current"));
    }
    // The while loop can move to next state by assigning nextState
    if (nextState) {
      console.log(`nextState ${nextState}`);
    }
  }

  return T();
};

export { TaskRAG_async };