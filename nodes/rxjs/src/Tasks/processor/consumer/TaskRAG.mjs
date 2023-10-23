/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import weaviate from 'weaviate-ts-client';
import { utils } from '#src/utils';
import OpenAI from "openai";
import { NODE } from "#root/config";
import path from 'path';
import fs from 'fs';

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
  const operatorLLM = operators["LLM"].module;

  const serviceConfig = T("services.chat");

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
  const className = T("config.local.corpusName");
  let queryVector;

  const client = weaviate.client({
    scheme: NODE.storage.weaviateScheme,
    host: NODE.storage.weaviateHost,
  });

  const queryWeaviateCache_async = async (queryVector) => {
    const response = await client.graphql
    .get()
    .withClassName(className)
    .withFields('title tokenLength text _additional {distance certainty}')
    .withWhere({
      path: ['title'],
      operator: 'Equal',
      valueText: CACHE_ID,
    })
    .withNearVector({ 
      vector: queryVector,
      //"distance": T("config.local.maxDistance") || 0.14,
    })
    .withLimit(1)
    .do();
    utils.logTask(T(), "queryWeaviateCache_async response for className", className, response['data']['Get'][className]);
    let filteredResult;
    let filteredResultClose;
    for (const obj of response['data']['Get'][className]) {
      if (obj._additional.distance < (T("config.local.maxCacheDistance") || 0.02)) {
        filteredResult = obj;
        console.log("queryWeaviateCache_async hit", obj._additional.distance);
      }
      if (obj._additional.distance < 0.05) {
        filteredResultClose = obj;
        console.log("queryWeaviateCache_async close", obj._additional.distance);
      }
    }
    return [filteredResult, filteredResultClose];
  }

  const queryWeaviate_async = async (queryVector) => {
    //utils.logTask(T(), `Topic ${query} queryVector`, queryVector);
    // Query using nearVector - https://weaviate.io/developers/weaviate/api/graphql/search-operators#nearvector
    const response = await client.graphql
    .get()
    .withClassName(className)
    .withFields('title filename page_number tokenLength text _additional {distance certainty}')
    .withWhere({
      path: ['mergedSection'],
      operator: 'Equal',
      valueBoolean: true
    })
    .withNearVector({ 
      vector: queryVector,
      //"distance": T("config.local.maxDistance") || 0.14,
    })
    .withAutocut(1)
    .withLimit(T("config.local.maxChunks") || 10)
    .do();
    utils.logTask(T(), "queryWeaviate_async response for className", className, response['data']['Get'][className]);
    let filteredResults = [];
    for (const obj of response['data']['Get'][className]) {
      if (obj._additional.distance < (T("config.local.maxDistance") || 0.14)) {
        filteredResults.push(obj);
      }
    }
    /*
    const resp = await client.graphql
      .aggregate()
      .withClassName(className)
      .withFields('meta { count }')
      .do();
    console.log(JSON.stringify(resp, null, 2));
    */
    return filteredResults;
  };

  const queryWeaviateSections_async = async (sections, queryVector) => {
    utils.logTask(T(), "sections", sections);
    // Query using nearVector - https://weaviate.io/developers/weaviate/api/graphql/search-operators#nearvector
    let response;
    if (sections.length) {
      response = await client.graphql
        .get()
        .withClassName(className)
        .withFields('text filename page_number tokenLength _additional {distance certainty}')
        .withWhere({
          operator: "And",
          operands: [
            {
              path: ['mergedSection'],
              operator: 'Equal',
              valueBoolean: false,
            },
            {
              path: ['title'],
              operator: 'ContainsAny',
              valueTextArray: sections,
            },
          ]
        })
        .withNearVector({ 
          vector: queryVector,
          //"distance": T("config.local.maxDistance") || 0.14,
        })
        .withAutocut(2)
        .withLimit(T("config.local.maxChunks") || 10)
        .do();
      } else {
        response = await client.graphql
          .get()
          .withClassName(className)
          .withFields('text filename page_number tokenLength _additional {distance certainty}')
          .withWhere({
            path: ['mergedSection'],
            operator: 'Equal',
            valueBoolean: false,
          })
          .withNearVector({ 
            vector: queryVector,
            //"distance": T("config.local.maxDistance") || 0.14,
          })
          .withAutocut(2)
          .withLimit(T("config.local.maxChunks") || 10)
          .do();
      }
    utils.logTask(T(), "queryWeaviateSections_async response for className with sections", sections, response['data']['Get'][className]);
    let filteredResults = [];
    for (const obj of response['data']['Get'][className]) {
      if (obj._additional.distance < (T("config.local.maxDistance") || 0.14)) {
        filteredResults.push(obj);
      }
    }
    return filteredResults;
  };

  async function getMetadata_async(metadata, element) {
    if (!metadata[element.filename]) {
      const jsonFileName = path.basename(element.filename).replace(/\.[^/.]+$/, '.json');
      const metadataFilePath = path.join(metadataDir, jsonFileName);
      console.log("metadataFilePath", metadataFilePath);
      let elementMetadata;
      try {
        const metadataContent = await fs.promises.readFile(metadataFilePath, 'utf-8'); // Read the file content as UTF-8 text
        elementMetadata = JSON.parse(metadataContent); // Parse the JSON content
      } catch (error) {
        elementMetadata = {};
      }
      console.log("elementMetadata", elementMetadata);
      metadata[element.filename] = elementMetadata;
    }
  }

  function addReference(metadata, element) {
    let prefix = '';
    prefix += `The context below, starting with <BEGIN> and ending with <END> was extacted from <TITLE>"${metadata.title}"</TITLE>`;
    if (metadata.author) {
      prefix += ` authored by <AUTHOR>${metadata.author}</AUTHOR>`;
    }
    if (element.page_number) {
      prefix += ` on page <PAGE>${element.page_number}</PAGE>`;
    }
    prefix += "\n<BEGIN>\n";
    let postfix = "\n<END>\n"
    const context = "\n" + prefix + element.text + postfix;
    return context;
  }

  let nextState = T("state.current");
  let context = '';
  const corpusDir = path.join(NODE.storage.dataDir, "RAG", T("config.local.corpusName"));
  const metadataDir = path.join(corpusDir, 'metadata');
  const CACHE_ID = "TASKFLOW CACHE";
  let cache;

  while (!T("command") && nextState) {
    T("state.current", nextState);
    nextState = null;
    switch (T("state.current")) {
      case "start":
        break;
      case "input":
        break;
      case "sent": {
        //nextState = "debug";
        //break;
        const query = T("input.query");
        queryVector = await embedText_async(query);
        let close;
        [cache, close] = await queryWeaviateCache_async(queryVector);
        if (cache) {
          nextState = "prompt";
        } else {
          if (close) {
            queryVector = await embedText_async(close.text);
          }
          response = await queryWeaviate_async(queryVector)
          console.log("response:", response);
          if (!response.length) {
            response = await queryWeaviateSections_async([], queryVector);
            nextState = "rewriteQuery";
          } else {
            nextState = "context";
          }
        }
        break;
      }
      case "rewriteQuery": {
        let prompt = '';
        // Just let chatGPT try to anser
        if (T("config.local.user")) {
          prompt += "This query is from " + T("config.local.user") + "\n";
        }
        prompt += T("config.local.rewritePrompt") || `Answer this query or if you do not have enough information the provide a bullet list of concepts that could help clarify this question.`;
        prompt += "\n" 
        prompt += T("input.query");
        T("request.prompt", prompt);
        serviceConfig["noStreaming"] = true;
        console.log("noStreaming", serviceConfig);
        const operatorOut = await operatorLLM.operate_async(wsSendTask, T());
        serviceConfig["noStreaming"] = false; 
        const query = T("input.query") + "\n" + operatorOut.response.LLM;
        queryVector = await embedText_async(query);
        response = await queryWeaviate_async(queryVector);
        nextState = "context";
        break;
      }
      case "context": {
        let titles = [];
        let tokens = 0;
        const availableTokens = serviceConfig.maxTokens - 1000; // leave space for response
        let metadata = {};
        const maxSections = 1;
        if (response.length) {
          let i = 0;
          for (const element of response) {
            await getMetadata_async(metadata, element);
            const elementContext = addReference(metadata[element.filename], element);
            const newTokenLength = utils.stringTokens(elementContext);
            if ((tokens + newTokenLength) >= availableTokens) {
              console.log("Breaking out of context loop tokens:", tokens);
              // Don't break so we accumulate all the titles
              break;  // Exit the loop early if tokens exceed or are equal to availableTokens
            } else {
              tokens += newTokenLength;
            }
            context += elementContext;
            titles.push(element.title);
            console.log("element:", element);
            i++;
            if (i >= maxSections) {
              break;
            }
          }
          //console.log("Found titles", titles);
        }
        const approxTokenCount = tokens;
        // Complete with chunks
        if (approxTokenCount < availableTokens) {
          // Request chunks that make up the sections
          console.log("Requesting chunks that make up the sections");
          response = await queryWeaviateSections_async(titles, queryVector);
          tokens = 0;
          if (response) {
            for (const element of response) {
              await getMetadata_async(metadata, element);
              const elementContext = addReference(metadata[element.filename], element);
              const newTokenLength = utils.stringTokens(elementContext);
              tokens += newTokenLength;
              if (tokens >= availableTokens) {
                break;
                // Exit the loop early if tokens exceed or are equal to availableTokens
              }
              context += "\n" + elementContext;
              titles.push(element.title);
            }            
          }
        } else {
          console.log(`Using context with approxTokenCount ${approxTokenCount}`);
        }
        nextState = "prompt";
        break;
      }
      case "prompt": {
        if (cache) {
          console.log("Returning cached response", cache);
          T("response.result", cache.text);
          T("response.retrieved", false);
        } else if (!context) {
          if (T("config.local.noInformation")) {
            T("response.result", T("config.local.noInformation"));
          } else {
            let prompt = `You are part of a RAG system and you do not have sufficient information to answer this question. Suggest how the user could clarify their question.`;
            prompt += `
            Question : ${T("input.query")}
            Réponse :`;
            T("request.prompt", prompt);
            const operatorOut = await operatorLLM.operate_async(wsSendTask, T()); 
            T("response.result", operatorOut.response.LLM);
          }
          T("response.retrieved", false);
        } else {
          let prompt = T("config.local.contextPrompt") || `Use the following pieces of context to answer the question at the end. If you're not sure, just say so. If there are multiple possible answers, summarize them as possible answers.`;
          prompt += `Cite the relevant reference material at the end of your response using the information from the <TITLE>, <AUTHOR>, <PAGE> tags in the context.`
          prompt += `
          Context : ${context}
          Question : ${T("input.query")}
          Réponse : (remember to cite the relevant reference material at the end of your response)`;
          T("request.prompt", prompt);
          const operatorOut = await operatorLLM.operate_async(wsSendTask, T()); 
          T("response.result", operatorOut.response.LLM);
          T("response.retrieved", true);
        }
        T("response.query", T("input.query"));
        T("state.current", "response");
        T("command", "update");
        break;
      }
      case "response":
        // Store response to the DB
        if (T("response.retrieved")) {
          queryVector = await embedText_async(T("response.query"));
          await client.data
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
      case "debug": {
        T("response.query", "What is the CACES?");
        queryVector = await embedText_async(T("response.query"));
        cache = await queryWeaviateCache_async(queryVector),
        console.log("Stored result for query", T("input.query"), cache);
        break;
      }
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