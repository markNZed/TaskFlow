/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import weaviate from 'weaviate-ts-client';
import fetch from 'node-fetch';
import { utils } from '#src/utils';
import OpenAI from "openai";
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

// Example code based on https://weaviate.io/developers/weaviate/tutorials/custom-vectors

/*

Unstructured API

https://github.com/Unstructured-IO/unstructured-api#dizzy-instructions-for-using-the-docker-image

From the /app directory:
curl -X 'POST' 'http://unstructured:8000/general/v0/general' -H 'accept: application/json' -H 'Content-Type: multipart/form-data' -F 'files=@data/rag/corpus/pdf/ed6348-autorisation-de-conduite-et-CACES.pdf' | jq -C . | less -R

*/

// eslint-disable-next-line no-unused-vars
const TaskWeaviate_async = async function (wsSendTask, T, FSMHolder) {

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

  const client = weaviate.client({
    scheme: 'http',
    host: 'weaviate:8080',
  });

  // Class definition object. Weaviate's autoschema feature will infer properties when importing.
  const className = 'Question';
  const classObj = {
    class: className,
    vectorizer: 'none',
  };

  async function getJsonData() {
    const file = await fetch('https://raw.githubusercontent.com/weaviate-tutorials/quickstart/main/data/jeopardy_tiny+vectors.json');
    return file.json();
  }

  async function importQuestionsWithVectors() {
    // Get the questions directly from the URL
    const data = await getJsonData();

    // Prepare a batcher. Even though this dataset is tiny, this is the best practice for import.
    let batcher = client.batch.objectsBatcher();
    let counter = 0;
    let batchSize = 100;

    for (const item of data) {
      // Construct the object to add to the batch
      const obj = {
        class: className,
        properties: {
          answer: item.Answer,
          question: item.Question,
          category: item.Category,
        },
        vector: item.Vector,
      }

      // add the object to the batch queue
      batcher = batcher.withObject(obj);

      // When the batch counter reaches batchSize, push the objects to Weaviate
      if (counter++ % batchSize === 0) {
        // Flush the batch queue and restart it
        await batcher.do();
        batcher = client.batch.objectsBatcher();
      }
    }

    // Flush the remaining objects
    await batcher.do();
    console.log(`Finished importing ${counter} objects.`);
  }

  const demoWeaviate_async = async () => {

    // Uncomment to delete all Question objects if you see a "Name 'Question' already used" error
    await client.schema.classDeleter().withClassName(className).do();

    // Add the class to the schema
    await client.schema.classCreator().withClass(classObj).do();

    // Import data from the remote URL
    /*
    type JeopardyItem = {
      Answer: string;
      Question: string;
      Category: string;
      Vector: number[],
    }
    */

    await importQuestionsWithVectors();

    const topic = T("input.question") || "biology";

    const demoVector = await embedText_async(topic);

    utils.logTask(T(), `Topic ${topic} demoVector`, demoVector);

    // Query using nearVector - https://weaviate.io/developers/weaviate/api/graphql/search-operators#nearvector
    response = await client.graphql
    .get()
    .withClassName(className)
    .withFields('question answer category _additional {distance}')
    .withNearVector({ vector: demoVector })
    .withLimit(2)
    .do();

    utils.logTask(T(), "response", response['data']['Get'][className]);

  };

  /* 
    Parameters
      coordinates: When elements are extracted from PDFs or images, it may be useful to get their bounding boxes as well. Set the coordinates parameter to true to add this field to the elements in the response.
      encoding: You can specify the encoding to use to decode the text input. If no value is provided, utf-8 will be used.
      ocr_languages: specify what languages to use for OCR with the ocr_languages kwarg
      output_format: By default the result will be in json, but it can be set to text/csv to get data in csv format
      include_page_breaks: Pass the include_page_breaks parameter to true to include PageBreak elements in the output.
      strategy: Four strategies are available for processing PDF/Images files: hi_res, fast, ocr_only, and auto. fast is the default strategy and works well for documents that do not have text embedded in images.
      
  */
  const postToUnstructured = async (options = {}) => {
    const {
      coordinates,
      encoding,
      ocrLanguages,
      outputFormat,
      includePageBreaks,
      strategy,
      file,
    } = options;
    const form = new FormData();
    form.append('files', fs.createReadStream(file));
    const headers = {
      'Accept': 'application/json',
      ...form.getHeaders()
    };
    const params = {};
    if (coordinates !== undefined) params.coordinates = coordinates;
    if (encoding !== undefined) params.encoding = encoding;
    if (ocrLanguages !== undefined) params.ocr_languages = ocrLanguages;
    if (outputFormat !== undefined) params.output_format = outputFormat;
    if (includePageBreaks !== undefined) params.include_page_breaks = includePageBreaks;
    if (strategy !== undefined) params.strategy = strategy;
    const config = {
      method: 'post',
      url: 'http://unstructured:8000/general/v0/general',
      headers,
      data: form,
      params
    };
    try {
      const response = await axios(config);
      console.log(JSON.stringify(response.data));
    } catch (error) {
      console.error(error);
    }
  };

  switch (T("state.current")) {
    case "start":
      break;
    case "input":
      break;
    case "sent":
      await postToUnstructured({
        file: '/app/data/rag/corpus/pdf/ed6348-autorisation-de-conduite-et-CACES.pdf',
      });
      await demoWeaviate_async();
      T("state.current", "response");
      T("response.answer", response);
      T("command", "update");
      break;
    case "response":
      break;
    default:
      console.log("WARNING unknown state : " + T("state.current"));
  }

  return T();
};

export { TaskWeaviate_async };