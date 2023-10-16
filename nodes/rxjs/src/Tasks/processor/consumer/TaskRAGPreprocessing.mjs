/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import weaviate from 'weaviate-ts-client';
import OpenAI from "openai";
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import { SingleBar } from 'cli-progress';
import { utils } from '#shared/utils';

// eslint-disable-next-line no-unused-vars
const TaskRAGPreprocessing_async = async function (wsSendTask, T, FSMHolder) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const configuration = {
    apiKey: OPENAI_API_KEY,
  };
  const openai = new OpenAI(configuration);

  async function embedTextBatch_async(inputTextArray) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: inputTextArray,
      });
  
      const embeddings = response.data.map((item) => item.embedding);
      return embeddings;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  const client = weaviate.client({
    scheme: 'http',
    host: 'weaviate:8080',  // Replace with your endpoint
  });

  const searchDirectory_async = async (dirPath) => {
    if (typeof dirPath !== 'string') {
      console.error("Invalid directory path provided.");
      return [];
    }
    let result = [];
    try {
      const files = await fs.promises.readdir(dirPath);
      const promises = files.map(async (file) => {
        const filePath = path.join(dirPath, file);
        const stats = await fs.promises.stat(filePath);
        if (stats.isDirectory()) {
          const dirFiles = await searchDirectory_async(filePath);
          result.push(...dirFiles);
        } else {
          result.push(filePath);
          console.log(`Found file: ${filePath}`);
        }
      });
      await Promise.all(promises);
    } catch (error) {
      console.error(`An error occurred: ${error.message}`);
    }
    return result;
  };

  const excludeMetadataKeys = [
    "data_source",
    "coordinates",
    "links",
    "regex_metadata",
    "emphasized_texts",
    "detection_class_prob",
    "is_continuation",
  ];

  function createUnstructuredWeaviateClass(className = "UnstructuredDocument") {
    const ElementMetadata = {
      coordinates: null,
      data_source: null,
      filename: null,
      file_directory: null,
      last_modified: null,
      filetype: null,
      attached_to_filename: null,
      parent_id: null,
      category_depth: null,
      image_path: null,
      languages: null,
      page_number: "int",
      page_name: null,
      url: null,
      link_urls: null,
      link_texts: null,
      links: null,
      sent_from: null,
      sent_to: null,
      subject: null,
      section: null,
      header_footer_type: null,
      emphasized_text_contents: null,
      emphasized_text_tags: null,
      text_as_html: null,
      regex_metadata: null,
      max_characters: "int",
      is_continuation: null,
      detection_class_prob: null,
    };    
    const properties = [
      {
        name: "text",
        dataType: ["text"],
      },
      {
        name: "category",
        dataType: ["text"],
      },
    ];
    for (const [name, annotation] of Object.entries(ElementMetadata)) {
      if (!excludeMetadataKeys.includes(name)) {
        const dataType = annotationToWeaviateDataType(annotation);
        properties.push({
          name,
          dataType,
        });
      }
    }
    const classDict = {
      class: className,
      properties,
    };

    return classDict;
  }
  
  function annotationToWeaviateDataType(annotation) {
    if (annotation === null) {
      return ["text"];
    } else if (annotation.includes("str")) {
      return ["text"];
    } else if (annotation.includes("int")) {
      return ["int"];
    } else if (annotation.includes("date")) {
      return ["date"];
    } else {
      throw new Error(`Annotation ${annotation} does not map to a Weaviate dataType.`);
    }
  }
  
  function stage_for_weaviate(elements) {
    let data = [];
    for (const element of elements) {
      const properties = { ...element.metadata };
      for (const k of excludeMetadataKeys) {
        if (k in properties) {
          delete properties[k];
        }
      }
      properties.text = element.text;
      properties.category = element.category;
      data.push(properties);
    }
    return data
  }

  /* 
    https://unstructured-io.github.io/unstructured/api.html
    Parameters
      coordinates: When elements are extracted from PDFs or images, it may be useful to get their bounding boxes as well. Set the coordinates parameter to true to add this field to the elements in the response.
      encoding: You can specify the encoding to use to decode the text input. If no value is provided, utf-8 will be used.
      ocr_languages: specify what languages to use for OCR with the ocr_languages kwarg
      output_format: By default the result will be in json, but it can be set to text/csv to get data in csv format
      include_page_breaks: Pass the include_page_breaks parameter to true to include PageBreak elements in the output.
      strategy: Four strategies are available for processing PDF/Images files: hi_res, fast, ocr_only, and auto. fast is the default strategy and works well for documents that do not have text embedded in images.

      The stage_for_weaviate staging function prepares a list of Element objects for ingestion into the Weaviate vector database.
      
  */
  const unstructured_async = async (options = {}) => {
    const {
      coordinates,
      encoding,
      ocrLanguages,
      outputFormat,
      includePageBreaks,
      strategy,
      file,
    } = options;
    let response;
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
      response = await axios(config);
      //console.log(JSON.stringify(response.data));
    } catch (error) {
      console.error(error);
    }
    return response.data;
  };

  const parseFiles_async = async (pdfDir, parsedDir) => {
    const files = await searchDirectory_async(pdfDir);
    for (const file of files) {
      const parsedFilePath = path.join(parsedDir, path.basename(file).replace('.pdf', '.json'));
      try {
        await fs.promises.access(parsedFilePath); // Use fs.promises.access() for async operation
        console.log(`File ${parsedFilePath} already exists. Skipping.`);
      } catch (error) {
        console.log(`File ${parsedFilePath} does not exist. Processing...`);
        const result = await unstructured_async({ 
          file,
          coordinates: T("config.local.coordinates"),
          encoding: T("config.local.encoding"),
          ocrLanguages: T("config.local.ocrLanguages"),
          outputFormat: T("config.local.outputFormat"),
          includePageBreaks: T("config.local.includePageBreaks"),
          strategy: T("config.local.strategy"),
        });
        await fs.promises.writeFile(parsedFilePath, JSON.stringify(result)); // Use fs.promises.writeFile() for async operation
        console.log(`File ${parsedFilePath} has been created.`);
      }
    }
  };

  const checkBatchResult = (results) => {
    let result = true;
    if (results !== null) {
      results.forEach(result => {
        if (result.result && result.result.errors) {
          if (result.result.errors.error) {
            console.log(result.result.errors.error);
            result = false;
          }
        }
      });
    }
    return result;
  };

  async function ingest_async(className, data) {
    // Prepare a batcher
    let batcher = client.batch.objectsBatcher();
    let counter = 0;
    let batchSize = 100;

    for (const item of data) {
      // Construct the object to add to the batch
      const obj = {
        class: className,
        properties: {
          filename: item.filename,
          filetype: item.filetype,
          page_number: item.page_number,
          text: item.text,
        },
        vector: item.vector,
      }
      //console.log(obj);

      // add the object to the batch queue
      batcher = batcher.withObject(obj);

      // When the batch counter reaches batchSize, push the objects to Weaviate
      if (counter++ % batchSize === 0) {
        // Flush the batch queue and restart it
        try {
          const batchResult = await batcher.do();
          if (!checkBatchResult(batchResult)) {
            throw new Error(`Failed to import batch`);
          }
          console.log(`Batch of ${batchSize} successfully imported.`);
        } catch (error) {
          console.error(`Failed to import batch: ${error}`);
        }
        batcher = client.batch.objectsBatcher();
      }
    }
    // Flush the remaining objects
    await batcher.do();
    console.log(`Finished importing ${counter} objects.`);
  }


  // Function to read and parse a JSON file
  function readJSONFile(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error reading file ${filePath}: ${error.message}`);
      return null;
    }
  }

  // Function to process and ingest vectorized data from a single file
  async function ingestVectorizedFile_async(className, filePath, ingestedDir) {
    const jsonData = readJSONFile(filePath);
    if (jsonData) {
      const fileName = path.basename(filePath);
      const ingestedFilePath = path.join(ingestedDir, fileName);

      // Check if the file exists in the ingested directory
      if (!fs.existsSync(ingestedFilePath)) {
        // Process and ingest the jsonData as needed, e.g., ingest it into Weaviate
        // Replace this with your Weaviate ingestion logic
        console.log(`Processing and ingesting file: ${filePath}`);
        await ingest_async(className, jsonData);
        // Touch the file in the ingested directory to indicate it has been processed
        fs.writeFileSync(ingestedFilePath, '');
        console.log(`Touched file in ingested directory: ${ingestedFilePath}`);
      } else {
        console.log(`File already exists in ingested directory: ${ingestedFilePath}. Skipping ingestion.`);
      }
    }
  }

  // Function to process all vectorized files in the directory
  async function ingestAllVectorizedFiles_async(className, vectorizedDir, ingestedDir) {
    const files = fs.readdirSync(vectorizedDir);
    for (const file of files) {
      const filePath = path.join(vectorizedDir, file);
      await ingestVectorizedFile_async(className, filePath, ingestedDir);
    }
  }

  const corpusDir = T("config.local.corpusDir");
  const pdfDir = path.join(corpusDir, 'pdf');
  const parsedDir = path.join(corpusDir, 'parsed');
  const vectorizedDir = corpusDir + '/vectorized'; // Directory to save vectorized data
  const ingestedDir = corpusDir + '/ingested'; // Directory to save vectorized data

  switch (T("state.current")) {
    case "start":
      T("state.current", "parse");
      T("command", "update");
      break;
    case "parse": {
      await parseFiles_async(pdfDir, parsedDir);
      T("state.current", "vectorize");
      T("command", "update");
      break;
    }
    case "vectorize": {
      const files = await searchDirectory_async(parsedDir);
      for (const file of files) {
        // Create a filename for the vectorized JSON
        const vectorizedFilename = path.basename(file).replace('.pdf', '_vectorized.json');
        const vectorizedFilePath = path.join(vectorizedDir, vectorizedFilename);
        if (fs.existsSync(vectorizedFilePath)) {
          console.log(`File ${vectorizedFilePath} already exists. Skipping.`);
        } else {
          try {
            const fileContent = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
            const parsedJSON = JSON.parse(fileContent); // Parse the JSON content
            let weaviateData = stage_for_weaviate(parsedJSON)
            // Embed text and add vector to each element
            const batchSize = 100; // Set the batch size as needed
            // Create a new progress bar
            const progressBar = new SingleBar({
              format: 'Processing [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}',
              clearOnComplete: true,
            });
            progressBar.start(weaviateData.length, 0); // Start the progress bar with the total number of files
            for (let i = 0; i < weaviateData.length; i += batchSize) {
              const batch = weaviateData.slice(i, i + batchSize); // Get a batch of text items
              const inputTextArray = batch.map((element) => element.text);
              const embeddings = await embedTextBatch_async(inputTextArray);
              // Assign the embeddings to the elements in the batch
              for (let j = 0; j < batch.length; j++) {
                batch[j]["vector"] = embeddings[j];
                progressBar.update(i + j + 1); // Update the progress bar for each item in the batch
              }
            }
            progressBar.stop(); // Stop the progress bar when processing is complete
             // Write the vectorized data to the vectorized file
            await fs.promises.writeFile(vectorizedFilePath, JSON.stringify(weaviateData, null, 2)); // Use fs.promises.writeFile() for async operation
            console.log(`Vectorized data saved to ${vectorizedFilePath}`);
          } catch (error) {
            console.error(`Error reading file ${file}: ${error.message}`);
          }
        }
      }
      T("state.current", "ingest");
      T("command", "update");
      break;
    }
    case "ingest": {
      // Check if data has already been ingestd
      const className = 'PDF';
      const classObj = createUnstructuredWeaviateClass(className);
      await client.schema.classDeleter().withClassName(className).do();
      // The class doesn't exist, so create it
      await client.schema.classCreator().withClass(classObj).do();
      console.log(`Created class ${className} in Weaviate.`);
      console.log(`Created schema ${utils.js(classObj)} in Weaviate.`);
      // Process all vectorized files one by one
      await ingestAllVectorizedFiles_async(className, vectorizedDir, ingestedDir);
      T("state.current", "done");
      T("command", "update");
      break;
    }
    case "done":
      break;
    default:
      console.log("WARNING unknown state : " + T("state.current"));
  }

  return T();
};

export { TaskRAGPreprocessing_async };