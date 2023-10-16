/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import weaviate from 'weaviate-ts-client';
import { utils } from '#shared/utils';
import OpenAI from "openai";

/*
curl -X POST "http://weaviate:8080/v1/graphql" -H "Content-Type: application/json" -d '{
  "query": "{Aggregate {PDF {meta {count}}}}"
}'
*/

// eslint-disable-next-line no-unused-vars
const TaskRAG_async = async function (wsSendTask, T, FSMHolder) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

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

  let response;
  const className = 'PDF';

  const client = weaviate.client({
    scheme: 'http',
    host: 'weaviate:8080',
  });

  const queryWeaviate_async = async () => {
    const query = T("input.query");
    const queryVector = await embedText_async(query);
    //utils.logTask(T(), `Topic ${query} queryVector`, queryVector);
    // Query using nearVector - https://weaviate.io/developers/weaviate/api/graphql/search-operators#nearvector
    response = await client.graphql
    .get()
    .withClassName(className)
    .withFields('filename filetype page_number text _additional {distance}')
    .withNearVector({ vector: queryVector })
    .withLimit(T("config.local.maxChunks"))
    .do();
    utils.logTask(T(), "response for className", response['data']['Get'][className]);
    /*
    const resp = await client.graphql
      .aggregate()
      .withClassName(className)
      .withFields('meta { count }')
      .do();
    console.log(JSON.stringify(resp, null, 2));
    */
  };

  switch (T("state.current")) {
    case "start":
      break;
    case "input":
      break;
    case "sent":
      await queryWeaviate_async()
      T("state.current", "response");
      T("response.result", response);
      T("command", "update");
      break;
    case "response":
      break;
    default:
      console.log("WARNING unknown state : " + T("state.current"));
  }

  return T();
};

export { TaskRAG_async };