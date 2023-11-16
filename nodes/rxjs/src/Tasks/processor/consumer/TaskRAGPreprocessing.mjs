/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import weaviate, { generateUuid5 } from 'weaviate-ts-client';
import OpenAI from "openai";
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import { SingleBar } from 'cli-progress';
import { utils } from '#src/utils';
import { v4 as uuidv4 } from "uuid";
import { promises as fsPromises } from 'fs';
import { NODE } from "#root/config";
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/*
// For extractive summary
import { PythonRunner } from '#src/pythonRunner';
import { MessagingClient } from '#src/messaging';
import { fromEvent } from 'rxjs';
import { map, filter } from 'rxjs/operators';
*/
import cohere from 'cohere-ai';

/*
  NODE_NAME=processor-consumer ./nodes/rxjs/scripts/runFunction.js ./runFunctionTaskRAGPreprocessing.mjs TaskRAGPreprocessing dataProcessChunks | tee debug.log

  Unstructured Element types:
    FigureCaption
    NarrativeText
    ListItem
    Title
    Address
    Table
    PageBreak
    Header
    Footer
    UncategorizedText
    Image
    Formula

    What are the common patterns defining major parts in the hierarchy of the book ? For each pattern provide a JS regex that could identify the text as a major part. We are only interested in patterns that will result in a small number of matches - we want to extract the overall structure of the content.

    Basically use GPT to do the chunking into major sections

    For small documents can we use the GPT V to extract the content? Might be worth hooking this in so we can identify pages with diagrams (using Unstructured?) then convert to text with GPT V.

    For the website should be able to use the URL to get structure (could use site map too)

    The Unstructured API seems to support additiona parameters
    "model_name": null, 
    "xml_keep_tags": false, 
    "skip_infer_table_types": ["pdf", "jpg", "png"], 
    "languages": null, 
    "chunking_strategy": null, 
    "multipage_sections": false, 
    "combine_under_n_chars": 500, 
    "new_after_n_chars": 1500, 
    "max_characters": 1500,

    'hi_res_model_name=chipper'

*/

// eslint-disable-next-line no-unused-vars
const TaskRAGPreprocessing_async = async function (wsSendTask, T, FSMHolder) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations


  // This is an example of a worker thread
  // The worker runs a separate javascript process
  const worker = new Worker(join(__dirname, 'TaskRAGPreprocessing_worker.mjs'));
  worker.on('message', (msg) => {
    console.log(`Received message from worker: ${msg}`);
  });
  const message = { type: 'greeting', text: 'Hello, worker!' };
  // Send the object to the worker
  worker.postMessage(message);

  /*
  // This requires running Anaconda
  const PY_CHANNEL = 'channel_from_py';
  const JS_CHANNEL = 'channel_from_js';
  // Prepare the Python script runner
  const pythonRunner = PythonRunner.getInstance();
  // Start the runner with a specific Python module
  pythonRunner.start('runSumy');
  const messagingClient = new MessagingClient(NODE.storage.redisUrl);
  */

  const operators = T("operators");
  const operatorLLM = operators["LLM"].module;

  if (!operatorLLM) {
    console.log("operators:", operators)
    throw new Error("operatorLLM undefined")
  } 

  cohere.init(process.env.COHERE_API_KEY);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const client = weaviate.client({
    scheme: NODE.storage.weaviateScheme,
    host: NODE.storage.weaviateHost,
  });

  async function embedTextBatch_async(inputTextArray) {
    if (!inputTextArray) {
      console.error("No inputTextArray");
      throw new Error("No inputTextArray");
    }
    if (!inputTextArray.length) {
      console.error("No inputTextArray length");
      throw new Error("No inputTextArray length");
    }
    inputTextArray = inputTextArray.map(item => {
      if (item === "") {
        console.error("Empty string found in inputTextArray");
        return " ";
      }
      return item;
    });
    // Function to create a pause (simple rate limit)
    const pause = (duration) => new Promise(resolve => setTimeout(resolve, duration));

    try {
      // Pause for 1 second (1000 milliseconds)
      await pause(1000);
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: inputTextArray,
      });
      const embeddings = response.data.map((item) => item.embedding);
      return embeddings;
    } catch (error) {
      console.error(`ERROR embedTextBatch_async inputTextArray length ${inputTextArray.length}`, error); 
      return [];
    } 
  }

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
      coordinates: ["text"],
      data_source: ["text"],
      filename: ["text"],
      file_directory: ["text"],
      last_modified: ["date"],
      filetype: ["text"],
      attached_to_filename: ["text"],
      parent_id: ["text"],
      category_depth: ["int"],
      image_path: ["text"],
      languages: ["text[]"],
      page_number: ["int"],
      page_name: ["text"],
      url: ["text"],
      link_urls: ["text[]"],
      link_texts: ["text[]"],
      links: ["text[]"],
      sent_from: ["text"],
      sent_to: ["text"],
      subject: ["text"],
      section: ["text"],
      header_footer_type: ["text"],
      emphasized_text_contents: ["text"],
      emphasized_text_tags: ["text[]"],
      text_as_html: ["text"],
      regex_metadata: ["text"],
      max_characters: ["int"],
      is_continuation: ["boolean"],
      detection_class_prob: ["number"],
    };    
    const properties = [
      {
        name: "text",
        dataType: ["text"],
      },
      {
        name: "title",
        dataType: ["text"],
        tokenization: "field", // required to match on data with symbols 
      },
      {
        name: "mergedSection",
        dataType: ["boolean"],
      },
      {
        name: "tokenLength",
        dataType: ["int"],
      },
      {
        name: "cache",
        dataType: ["boolean"],
      },
      {
        name: "query",
        dataType: ["text"],
      },
      {
        name: "cachePrefix",
        dataType: ["text"],
      },
      {
        name: "elementCount",
        dataType: ["number"],
      },
      {
        name: "merged",
        dataType: ["boolean"],
      },
      {
        name: 'sectionCount',
        dataType: ["number"],
      },
      {
        name: 'summary',
        dataType: ["boolean"],
      }
    ];
    for (const [name, dataType] of Object.entries(ElementMetadata)) {
      if (!excludeMetadataKeys.includes(name)) {
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
      ocr_languages: specify what languages to use for OCR with the ocr_languages kwarg see https://github.com/tesseract-ocr/tessdata
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

    if (coordinates !== undefined) form.append('coordinates', String(coordinates));
    if (encoding !== undefined) form.append('encoding', String(encoding));
    if (ocrLanguages !== undefined) form.append('ocr_languages', String(ocrLanguages));
    if (outputFormat !== undefined) form.append('output_format', String(outputFormat));
    if (includePageBreaks !== undefined) form.append('include_page_breaks', String(includePageBreaks));
    if (strategy !== undefined) form.append('strategy', String(strategy));
    
    const headers = {
      'Accept': 'application/json',
      'unstructured-api-key': process.env.UNSTRUCTURED_API_KEY,
      ...form.getHeaders()
    };

    //console.log("unstructured_async axios headers", JSON.stringify(headers, null, 2));

    const config = {
      method: 'post',
      url: 'http://unstructured:8000/general/v0/general',
      headers,
      data: form,
    };
    try {
      //console.log("unstructured_async axios config", JSON.stringify(config, null, 2));
      response = await axios(config);
      //console.log(JSON.stringify(response.data));
    } catch (error) {
      console.error(error);
    }
    return response?.data;
  };

  const unstructuredFiles_async = async (inputDir, outputDir, nextDir) => {
    const files = await searchDirectory_async(inputDir);
    for (const file of files) {
      const outputFilePath = path.join(outputDir, path.basename(file).replace(/\.[^.]+$/, '.json'));
      try {
        await fs.promises.access(outputFilePath); // Use fs.promises.access() for async operation
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } catch (error) {
        console.log(`File ${outputFilePath} does not exist. Processing...`);
        let elements = await unstructured_async({ 
          file,
          coordinates: T("config.local.coordinates"),
          encoding: T("config.local.encoding"),
          ocrLanguages: T("config.local.ocrLanguages"),
          outputFormat: T("config.local.outputFormat"),
          includePageBreaks: T("config.local.includePageBreaks"),
          strategy: T("config.local.strategy"),
        });
        console.log(`Unstructured ${elements.length} elements`);
        /*
        for (const element of elements) {
          if (element.metadata?.languages) {
            element.metadata["languages"] = element.metadata.languages.join(' ');
          }
        }
        */
        await fs.promises.writeFile(outputFilePath, JSON.stringify(elements, null, 2));
        console.log(`File ${outputFilePath} has been created.`);
        const nextFilename = path.basename(outputFilePath);
        await deleteNextFile (nextFilename, nextDir)
      }
    }
  };

  const chunkFiles_async = async (unstructuredDir, chunkedDir, nextDir) => {
    const files = await searchDirectory_async(unstructuredDir);
    for (const file of files) {
      const outputFilePath = path.join(chunkedDir, path.basename(file));
      try {
        await fs.promises.access(outputFilePath); // Use fs.promises.access() for async operation
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } catch (error) {
        console.log(`File ${outputFilePath} does not exist. Processing...`);
        const fileContent = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
        const elements = JSON.parse(fileContent); // Parse the JSON content
        console.log(`Unstructured ${elements.length} elements`);

        let i = 0;
        let currentTitle = ""; // Empty for the initial elements that are not under a title
        let prevTitle;
        let isMerging = false;
        let mergedText = '';
        let mergedTextTokens = 0;
        let lastElementType;
        let newElements = [];
        let mergedSection = '';
        let mergedSectionTokens = 0;
        let isMergingSection = false;
        let sectionCount = 0;
        let elementCount = 0;
        let filename;
        let filetype;

        const maxTokenLength = 2000;

        // eslint-disable-next-line no-inner-declarations
        function createSectonElement(element) {
          if (!mergedSection) {
            throw new Error("No mergedSection");
          }
          const newElement = {
            type: "NarrativeText",
            element_id: uuidv4(),
            text: mergedSection,
            metadata: {
              filename,
              filetype,
              page_number: element.metadata.page_number,
              section: prevTitle,
              mergedSection: true,
              title: prevTitle,
              sectionCount: sectionCount,
            },
          }
          newElements.push(newElement);
          sectionCount++;
          if (sectionCount === 1) {
            console.log("First section:", mergedSection);
          }
        }

        // eslint-disable-next-line no-inner-declarations
        function mergeText(element) {
          element.text = mergedText;  // Update the original element text
          isMerging = false;  // Reset merging state
          mergedText = '';  // Reset mergedText
          mergedTextTokens = 0;
          element.metadata["merged"] = true;
        }
        
        while (i < elements.length) {
          let element = elements[i];
          const wordLength = element.text.split(' ').length;
          const tokenLength = utils.stringTokens(element.text);
          let ignore = false;
          // Do not consider Title starting with lower case to be a Title
          const startsWithLowercase = element.text.match(/^[a-z]/) !== null;
          element.metadata["elementCount"] = elementCount;
          if (!element?.metadata?.filename) {
            console.log("No filename", element);
          }
          if (!filename && element.metadata.filename) {
            filename = element.metadata.filename;
          }
          if (!filetype && element.metadata.filetype) {
            filetype = element.metadata.filetype;
          }
          if (element.type === "Title" && startsWithLowercase){
            element.type = "UncategorizedText";
          }
          // We do not want to include short UncategorizedText e.g. text in diagrams
          if (element.type === "UncategorizedText") {
            if (wordLength < 5) {
              element.metadata["delete"] = true;
              isMerging = false;
              ignore = true;
            } else {
              element.type = "NarrativeText";
            }
          }
          // If there are sequential Title elements then merge them
          if (element.type === "Title") {
            if (lastElementType === "Title") {
              if (currentTitle.length + element.text.length < 100) {
                currentTitle =  currentTitle + ' ' + element.text;
              }
            } else {
              prevTitle = currentTitle;
              currentTitle = element.text;
            }
            element.metadata["delete"] = true;
            isMerging = false;
          // If there are sequences of short NarrativeText then merge them until reaching a period character.
          } else {
            if (isMerging || (element.type === "NarrativeText" && wordLength < 20 )) {
              const mergedTokenLength = mergedTextTokens + tokenLength;
              if (mergedTokenLength > maxTokenLength) {
                console.log(`${i} id ${element.element_id} ${mergedTokenLength} exceeded ${maxTokenLength} tokens. tokenLength`, tokenLength);
                const prevMergedText = mergedText;
                mergeText(element)
                // Calculate the starting index for the last 10%
                let startIndex = Math.floor(prevMergedText.length * 0.9);
                // Extract the last 10% of the string for context
                let lastPercent = prevMergedText.slice(startIndex);
                const last10PercentTokens = utils.stringTokens(lastPercent);
                const elementTokens = utils.stringTokens(element.text);
                mergedText = lastPercent;
                mergedTextTokens = utils.stringTokens(mergedText);
                console.log(`${i} mergedTextTokens`, mergedTextTokens, "last10PercentTokens", last10PercentTokens, "elementTokens", elementTokens, "startIndex", startIndex, "mergedText.length", mergedText.length);
              } else {
                mergedText += " " + element.text;
                mergedTextTokens += tokenLength;
                if (!isMerging && currentTitle) {
                  mergedText = currentTitle + ": ";
                }
                if (element.text.endsWith('.')) {
                  mergeText(element)
                } else {
                  element.metadata["delete"] = true;
                  isMerging = true;  // Set merging state
                }
              }
            } else if (currentTitle) {
              element.text = currentTitle + ": " + element.text;
              element.metadata["title"] = currentTitle;
            }
          }
          // Build sections
          if (!ignore) {
            if ((tokenLength < maxTokenLength) && (isMergingSection || element.type !== "Title")) {
              if (mergedSectionTokens + tokenLength > maxTokenLength) {
                console.log(`id ${element.element_id} section exceeded ${maxTokenLength} tokens`)
                createSectonElement(element);
                mergedSectionTokens = 0;
                // Calculate the starting index for the last 10%
                let startIndex = Math.floor(mergedSection.length * 0.9);
                let lastPercent = mergedSection.slice(startIndex);
                // Keep an overlap of 25% if we need to "chop" up sections
                mergedSection = lastPercent;
              } 
              const sectionLength = mergedSection.split(' ').length;
              if (element.type === "Title" && sectionLength > 100) {
                createSectonElement(element)
                isMergingSection = false;  // Reset
                mergedSection = '';  // Reset
                mergedSectionTokens = 0; // Reset
              } else {
                mergedSection += element.text;
                isMergingSection = true;
              }
            } 
            if (!element?.metadata?.mergedSection) {
              element.metadata["mergedSection"] = false;
            }
          }
          //console.log("Element", utils.js(element));
          lastElementType = element.type;
          i++;  // Move to the next element outside of the NarrativeText condition
          elementCount++;
          if (sectionCount === 0) {
            //console.log("Initial elements:", element);
            //console.log("mergedSection:", mergedSection);
          }
        }
        let filteredElements = elements.filter(element => {
          if (element.metadata["delete"]) {
            //console.log("Deleting", element.type, element.text);
            return false;
          } else {
            return true;
          }
        }) 
        console.log(`After filtering ${filteredElements.length} elements`);
        filteredElements = [...filteredElements, ...utils.deepClone(newElements)];
        newElements = [];
        console.log(`After adding newElements ${filteredElements.length} elements`);
        // Add token length to each element
        for (const element of filteredElements) {
          // Split elements if they are too big
          let tokenLength = utils.stringTokens(element.text);
          let remainingText = element.text;
          let extractLength = Math.floor(maxTokenLength * 0.95);
          while (tokenLength > maxTokenLength && !element.metadata?.delete) {  
            const extractedString = remainingText.slice(0, extractLength);
            const lengthWithOverlap = Math.floor(extractLength * 0.75);
            remainingText = remainingText.slice(lengthWithOverlap);
            const newElement = {
              type: element.type,
              element_id: uuidv4(),
              text: currentTitle + ": " + extractedString,
              metadata: element.metadata,
            }
            newElements.push(newElement);
            element.text = remainingText;
            const remainingTextTokens = utils.stringTokens(remainingText);
            console.log(`chunkFiles_async tokenLength ${tokenLength} was greater then maxTokenLength ${maxTokenLength} remaining ${remainingTextTokens}`);
            tokenLength = remainingTextTokens;
          }
        }
        filteredElements = [...filteredElements, ...newElements];
        for (const element of filteredElements) {
          element.metadata["tokenLength"] = utils.stringTokens(element.text);
          if (element.metadata.tokenLength > 2000) {
            console.log("Unexpected tokenLength > 2000", utils.js(element));
            throw new Error("Unexpected tokenLength > 2000");
          }
        }
        await fs.promises.writeFile(outputFilePath, JSON.stringify(filteredElements, null, 2));
        console.log(`File ${outputFilePath} has been created.`);
        const nextFilename = path.basename(outputFilePath);
        await deleteNextFile (nextFilename, nextDir)
      }
    }
  };

  async function deleteNextFile(nextFilename, nextDir) {
    if (T("config.local.ripple")) {
      const nextFilePath = path.join(nextDir, nextFilename);
  
      try {
        // Check if the file exists
        await fsPromises.stat(nextFilePath);
  
        // If the file exists, proceed to delete it
        await fsPromises.unlink(nextFilePath);
        console.log(`File ${nextFilePath} deleted successfully`);
      } catch (error) {
        // Catch errors related to file not existing or deletion issues
        if (error.code === 'ENOENT') {
          console.log(`File ${nextFilePath} does not exist.`);
        } else {
          console.error(`Error deleting file ${nextFilePath}:`, error.message);
        }
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
  async function textToMetadata_async(text, tokens) {
    //console.log("textToMetadata_async in length", text.substring(0, 256) + "...");
    console.log("textToMetadata_async in length", text.length, "tokens", tokens);
    /*
    const response = await openai.completions.create({ 
      model: 'gpt-3.5-turbo-instruct', 
      max_tokens: (4000 - tokens),
      prompt: "Below is the initial content of a document:\n\n" + text + + "\n\nBased on the previous initial content of the document (e.g. table of contents, introduction etc) generate an overview of what the full document will contain: \n",
    });
    console.log("textToMetadata_async response", utils.js(response));
    const content = response.choices[0].text;
    */
    const response = await openai.chat.completions.create({
      //model: 'gpt-4-1106-preview', // Supports response_format
      //response_format: {"type": "json_object"},
      model: 'gpt-4-0613',
      messages: [{ role: "user", content: `Below is the initial content of a document. Based on the partial content generate a metadata object that will validate against the following "Metadata" schema. Use the same language as the language in which the document is written for your response.:
      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "title": "Metadata",
        "properties": {
          "title": {
            "type": "string",
            "description": "The title or headline of the document, "
          },
          "author": {
            "type": "array",
            "description": "List of authors of the document.",
            "items": {
              "type": "string"
            }
          },
          "publicationDate": {
            "type": "string",
            "description": "The date the document was published.",
            "format": "date-time"
          },
          "keywords": {
            "type": "array",
            "description": "Keywords or tags summarizing the document.",
            "items": {
              "type": "string"
            }
          },
          "summary": {
            "type": "string",
            "description": "A summary or abstract of 300 words about the document, in the same language as the document."
          },
          "type": {
            "type": "string",
            "description": "The type of the document (e.g., research paper, news article, blog post).",
            "enum": ["Research Paper", "News Article", "Blog Post", "Book Chapter", "Other"]
          },
          "language": {
            "type": "string",
            "description": "The language in which the document is written."
          },
          "topic": {
            "type": "string",
            "description": "The primary subject or topic of the document."
          },
          "audience": {
            "type": "string",
            "description": "The intended audience for the document (e.g., general public, experts, students).",
            "enum": ["General Public", "Experts", "Students", "Other"]
          }
        },
        "required": ["title", "author", "publicationDate", "summary", "type", "language", "topic"]
      }
      
      The partial document starts with <BEGIN> and ends with <END>\n\n<BEGIN>\n\n${text}\nn<END>\n\nAbove is the initial content of a document. Based on that partial content (e.g. table of contents, introduction etc) generate a metadata object that will validate against the "Metadata" schema and complete each entry that you can. Use the same language as the document for your response.` }],
    });
    const content = response.choices[0].message.content;
    const regex = /\{.*\}/s; // match newlines
    const jsonData = content.match(regex); 
    let metadata;
    try {
      metadata = JSON.parse(jsonData);
    } catch {
      metadata = {};
    }
    //console.log("textToMetadata_async out", metadata)
    return metadata;
  }

  async function textToTOC_async(text) {
    //console.log("textToTOC_async in length", text.substring(0, 256) + "...");
    //console.log("textToTOC_async in length", text.length, "tokens", tokens);
    const messages= [{ 
      role: "user", 
      content: `Using the initial section(s) of a document, create a JSON object for a Table of Contents (TOC) that aligns with the predefined TOC schema 
        {
          "TOC": {
            "content": [
              {
                "type": "part",
                "number": "Part Number",
                "title": "Part Title",
                "chapters": [
                  {
                    "number": "Chapter Number",
                    "title": "Chapter Title",
                    "subsections": [
                      {
                        "number": "Subsection Number",
                        "title": "Subsection Title",
                      }
                    ]
                  }
                ]
              },
              {
                "type": "specialSection",
                "title": "Preface/Acknowledgments/Appendices/etc.",
              }
            ],
          }
        }      
        Ensure that your TOC captures all identifiable parts, chapters, and sections from the provided content. Titles and other text should be in the same language as the original document. If certain details are not available from the initial content, indicate them as 'TBD' (To Be Determined). Your goal is to generate a comprehensive and structured TOC that accurately reflects the document's content as per the schema.
        ` + text,
    }];
    // Because it gets chopped by console.log
    //process.stdout.write("textToTOC_async messages" + utils.js(messages) + '\n');
    const response = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview', // Supports response_format
      response_format: {"type": "json_object"},
      //model: 'gpt-4-0613',
      messages,
    });
    const content = response.choices[0].message.content;
    // Because it gets chopped by console.log
    //process.stdout.write("textToTOC_async content" + utils.js(content) + '\n');
    const regex = /\{.*\}/s; // match newlines
    const jsonData = content.match(regex); 
    let metadata;
    try {
      metadata = JSON.parse(jsonData) || {};
    } catch (err) {
      console.error("textToTOC_async", err, content);
      metadata = {};
    }
    //console.log("textToTOC_async out", utils.js(metadata))
    return metadata;
  }

  async function TOCRegexs_async(text) {
    const messages = [
      {
        role: "user",
        content: `We're looking to identify common patterns that define major parts within a document's hierarchy using JavaScript regular expressions (Regex). For each pattern you find, provide a JS regex that can identify the text as a major part. We're interested in patterns that yield a small number of matches, aiming to extract the overall structure from the content using regex. Keep the Regex simple.
    
        Below is a JSON object describing the content of the document you'll be working with:
        ${text}
    
        Your task is to generate JavaScript regex patterns that align with the predefined schema:
        {
          "type": "object",
          "properties": {
            "Regex": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "Pattern": {
                    "type": "string"
                  }
                },
                "required": ["Pattern"],
                "additionalProperties": false
              }
            }
          },
          "required": ["Regex"],
          "additionalProperties": false
        }        
    
        Your goal is to ensure that your regex captures all identifiable parts, chapters, and sections from the provided content. The ultimate aim is to create regex patterns that can effectively extract the document's content as per the given schema.
        `,
      }
    ];    
    // Because it gets chopped by console.log
    //process.stdout.write("TOCRegexs_async messages" + utils.js(messages) + '\n');
    const response = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview', // Supports response_format
      response_format: {"type": "json_object"},
      //model: 'gpt-4-0613',
      messages,
    });
    const content = response.choices[0].message.content;
    // Because it gets chopped by console.log
    //process.stdout.write("TOCRegexs_async content" + utils.js(content) + '\n');
    const regex = /\{.*\}/s; // match newlines
    const jsonData = content.match(regex); 
    let metadata;
    try {
      metadata = JSON.parse(jsonData) || {};
    } catch (err) {
      console.error("TOCRegexs_async", err, content);
      metadata = {};
    }
    //console.log("TOCRegexs_async out", utils.js(metadata))
    return metadata;
  }

  async function dataToTOC_async(text) {
    const messages = [
      {
        role: "user",
        content: `Given a sequence of text and page numbers extracted from a document, create a Table of Contents (TOC) in JSON format, adhering to the predefined schema. Your task is to identify the most likely page number for each title, considering that titles may appear multiple times in the document but the actual section or chapter probably starts at the latter mention. Check that the order of pages and numbering is coherent.
    
        Document content:
        ${text}
    
        The JSON schema for the TOC is as follows:
        {
          "type": "object",
          "properties": {
            "TOC": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "Page": {
                    "type": "number"
                  },
                  "Title": {
                    "type": "string"
                  },
                  "id": {
                    "type": "string"
                  },
                  "parent_id": {
                    "type": "string",
                    "nullable": true
                  }
                },
                "required": ["Page", "id", "Title"],
                "additionalProperties": false
              }
            }
          },
          "required": ["TOC"],
          "additionalProperties": false
        }
    
        Note: Each entry in the TOC should have a unique 'id'. The 'parent_id' is optional and should be used only if an entry is a subpart of another.`
      }
    ];
    
    // Because it gets chopped by console.log
    //process.stdout.write("dataToTOC_async messages" + utils.js(messages) + '\n');
    const response = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview', // Supports response_format
      response_format: {"type": "json_object"},
      //model: 'gpt-4-0613',
      messages,
    });
    const content = response.choices[0].message.content;
    // Because it gets chopped by console.log
    //process.stdout.write("dataToTOC_async content" + utils.js(content) + '\n');
    const regex = /\{.*\}/s; // match newlines
    const jsonData = content.match(regex); 
    let metadata;
    try {
      metadata = JSON.parse(jsonData) || {};
    } catch (err) {
      console.error("dataToTOC_async", err, content);
      metadata = {};
    }
    //console.log("dataToTOC_async out", utils.js(metadata))
    return metadata;
  }

  // eslint-disable-next-line no-unused-vars
  async function shrink_async(text) {
    //The text to generate a summary for. Can be up to 100,000 characters long. Currently the only supported language is English.
    // Should cache this
    console.log("Shrink in:", text)
    let shrunk = text;
    const generate = true;
    if (generate) {
      const response = await cohere.generate({
        prompt: "Extract the key concepts and generate a detailed summary in French." + text.substring(0, 100000),
      });
      console.log("Response:", utils.js(response));
      shrunk = response?.body?.generations[0]?.text || text;
    } else {
      const response = await cohere.summarize({
        text: text.substring(0, 100000),
        length: "long",
        extractiveness: "high",
        additional_command: "Extract the key concepts for a retrieval augmented generation system (RAG). Generate your summary in French."
      });
      shrunk = response?.body?.summary || text;
    }
    console.log("Shrunk out:", shrunk)
    return shrunk
  }

  // eslint-disable-next-line no-unused-vars
  async function summary_async(text, tokens) {
    const style = "cohere";
    if (style === "cohere") {
      //The text to generate a summary for. Can be up to 100,000 characters long. Currently the only supported language is English.
      // Should cache this
      const response = await cohere.summarize({
        text: text.substring(0, 100000),
        length: "auto",
      });
      console.log(response);
      return response?.body?.summary || "";
    } else {
      /*
      // Extractive summary
      console.log("Waiting for READY");
      // Ensure subscription to the Python channel
      await messagingClient.subscribe(PY_CHANNEL);
      // Listen for the READY message from the Python side
      const waitForReady = new Promise((resolve, reject) => {
        const initSubscription$ = fromEvent(messagingClient, 'message').pipe(
          map(([channel, message]) => ({ channel, message })),
          filter(({ channel }) => channel === PY_CHANNEL)
        ).subscribe({
          next: ({ message }) => {
            if (message === "READY") {
              console.log("Python side is READY");
              initSubscription$.unsubscribe(); // Unsubscribe after receiving READY
              resolve();
            }
          },
          error: (err) => {
            console.error('Error waiting for READY:', err);
            reject(err);
          },
        });
        // Now, send the "READY" request
        messagingClient.publish(JS_CHANNEL, "READY");
      });
      await waitForReady; // Wait until Python side is READY
      // Observable for logging every message and retrieving the summary
      const logMessage$ = fromEvent(messagingClient, 'message').pipe(
        map(([channel, message]) => ({ channel, message })),
        filter(({ channel }) => channel === PY_CHANNEL)
      );
      let summaryReceived = null;
      // A promise that waits for the summary
      const waitForSummary = new Promise((resolve, reject) => {
        logMessage$.subscribe({
          next: ({ message }) => {
            if (message !== "STOP") {
              console.log("Received:", message);
              summaryReceived = message;
            } else {
              resolve(summaryReceived);
            }
          },
          error: (err) => {
            console.error('Error:', err);
            reject(err);
          },
        });
      });
      // Send the text for summarization
      //text = text.substring(0, 1000);
      console.log(`Sending text of size ${new Blob([text]).size} bytes for summarization to ${JS_CHANNEL}`);
      messagingClient.publish(JS_CHANNEL, text);
      // Wait for the summary
      const summary = await waitForSummary;
      // Cleanup (e.g., unsubscribe)
      messagingClient.unsubscribe(PY_CHANNEL);
      return summary;
      */
    }
  }
  
  async function generateQuestions_async(summary, element) {
    console.log("generateQuestions_async Element", element);
    let prompt = `We are data processing for a RAG system with many documents. Here is a summary of the document we are analyzing. 
    Summary: ${summary}
    `;
    prompt += T("config.local.promptGenerateQuestions") || `Generate a JSON array of typical questions that can be fully answered using only the information in the context below. Only include questions that a human studying the related domain might ask. Only include questions that seek practical information for achieving real world goals. Your response must use the JSON schema and you should check that your JSON response will pass validaton against this schema .
    JSON schema:
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "QuestionsArray",
      "description": "An array of questions.",
      "type": "object",
      "properties": {
        "questions": {
          "type": "array",
          "description": "List of questions.",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "integer",
                "description": "Unique identifier for the question."
              },
              "content": {
                "type": "string",
                "description": "The content of the question."
              }
            },
            "required": ["id", "content"]
          }
        }
      },
      "required": ["questions"]
    }
    `;
    prompt += `
    Context: ${element.text}
    Response:`;
    T("request.prompt", prompt);
    const operatorOut = await operatorLLM.operate_async(wsSendTask, T()); 
    const response = operatorOut.response.LLM;
    // Parse the JSON if it's a string, otherwise assume it's already an object
    //console.log("response", response); 
    const regex = /\{.*\}/s; // match newlines
    const jsonData = response.match(regex); 
    let questionStrings = [];
    if (jsonData) {
      //console.log("jsonData", jsonData);    
      let data;
      try {
          data = JSON.parse(jsonData);
      } catch (err) {
          throw new Error("Failed to parse LLM content.");
      }
      //console.log("data", data);
      // Ensure that the 'questions' key exists and is an array
      if (!Array.isArray(data.questions)) {
          throw new Error("Invalid data: 'questions' key not found or not an array.");
      }
      questionStrings = data.questions.map(question => question.content);
      console.log("questionStrings:", questionStrings)
    } else {
      console.log("Could not find jsonData in ", response);
    }
    return questionStrings;
  }

  const dataProcessChunks_async = async (inputDir, outputDir, nextDir) => {
    const files = await searchDirectory_async(inputDir);
    for (const file of files) {
      const outputFilePath = path.join(outputDir, path.basename(file));
      const metadataFilePath = path.join(metadataDir, path.basename(file));
      try {
        await fs.promises.access(outputFilePath); // Use fs.promises.access() for async operation
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } catch (error) {
        console.log(`File ${outputFilePath} does not exist. Processing...`);
        const fileContent = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
        let elements = JSON.parse(fileContent); // Parse the JSON content
        console.log(`Chunked ${elements.length} elements`);
        let metadata;
        try {
          const metadataContent = await fs.promises.readFile(metadataFilePath, 'utf-8'); // Read the file content as UTF-8 text
          metadata = JSON.parse(metadataContent); // Parse the JSON content
        } catch (error) {
          metadata = {};
        }
        let questionElements = []
        let i = 0;
        let sectionCount = 0;
        let totalSections = 0;
        for (const element of elements) {
          if (!element.metadata.mergedSection) continue;
          totalSections++;
        }
        let numberToGenerate = totalSections;
        numberToGenerate = 0;
        //const progressBar = new SingleBar({
        //  format: 'Processing [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}',
        //  clearOnComplete: true,
        //});
        //progressBar.start(numberToGenerate, 0); // Start the progress bar with the total number of files
        for (let element of elements) {
          // Focus on sections
          if (!element.metadata.mergedSection) continue;
          sectionCount++;
          i++;
          if (i > numberToGenerate) {
            continue; // Just do this for numberToGenerate sections
          } else {
            //progressBar.update(i); // Update the progress bar for each item in the batch
          }
          //element["text"] = await shrink_async(element.text); // Not reliable in French
          //element["text"] = await textToMetadata_async(element.text)
          let questions = await generateQuestions_async(metadata.summary, element);
          questions = questions.map(question => ({
            type: element.type,
            text: question, 
            element_id: uuidv4(),
            metadata: {
              filename: element.metadata.filename,
              filetype: element.metadata.filetype,
              merged: false,
              mergedSection: false,
              tokenLength: utils.stringTokens(question),
              question: true,
              source_id: element.element_id,
            },
          }));
          questionElements = [...questionElements, ...questions];
        }
        //progressBar.stop(); 
        console.log(`Adding ${questionElements.length} questions for ${sectionCount} sections`);
        await fs.promises.writeFile(outputFilePath, JSON.stringify(elements, null, 2));
        console.log(`File ${outputFilePath} has been created.`);
        const nextFilename = path.basename(outputFilePath);
        await deleteNextFile (nextFilename, nextDir)
      }
    }
  };

  const extractMetadata_async = async (inputDir, outputDir) => {
    const files = await searchDirectory_async(inputDir);
    for (const file of files) {
      const outputFilePath = path.join(outputDir, path.basename(file));
      try {
        await fs.promises.access(outputFilePath); // Use fs.promises.access() for async operation
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } catch (error) {
        const fileContent = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
        const elements = JSON.parse(fileContent); // Parse the JSON content
        let sectionsMerged = "";
        let sectionsMergedToken = 0;
        // Assume we are limited to 4k context window
        const sectionsMergedMax = 3500;
        for (const element of elements) {
          if (element.metadata.mergedSection) continue;
          const elementTokens = utils.stringTokens(element.text)
          //console.log("element.metadata.sectionCount", element.metadata.sectionCount);
          if (sectionsMergedToken + elementTokens > sectionsMergedMax) break;
          sectionsMerged += element.text;
          sectionsMergedToken += elementTokens;// has issues with element.metadata.tokenLength;
        }
        const metadata = await textToMetadata_async(sectionsMerged, sectionsMergedToken);
        await fs.promises.writeFile(outputFilePath, JSON.stringify(metadata, null, 2));
      }
    }
  };

  const extractTopics_async = async (inputOutputDir) => {
    let files = await searchDirectory_async(inputOutputDir);
    const topicsFilePath = path.join(inputOutputDir, "taskflow-topics.json");
    try {
      await fs.promises.access(topicsFilePath); // Use fs.promises.access() for async operation
      console.log(`File ${topicsFilePath} already exists. Skipping.`);
    } catch (error) {
      let topics = [];
      files = files.filter(file => path.basename(file) !== path.basename(topicsFilePath));
      for (const file of files) {
        const metadataFilePath = path.join(inputOutputDir, path.basename(file));
        const fileContent = await fs.promises.readFile(metadataFilePath, 'utf-8');
        const metadata = JSON.parse(fileContent); // Parse the JSON content
        const topic = metadata?.topic;
        if (topic) { 
          console.log(`File ${metadataFilePath} has topic ${topic}`);
          topics.push(topic);
        } else {
          console.log(`File ${metadataFilePath} does not have metadata. Skipping.`);
        }
      }
      console.log(`Extracted ${topics.length} topics:`, topics);
      await fs.promises.writeFile(topicsFilePath, JSON.stringify(topics, null, 2));
    }
  }

  const extractTOC_async = async (inputDir, outputDir) => {
    const files = await searchDirectory_async(inputDir);
    for (const file of files) {
      const outputFilePath = path.join(outputDir, "TOC-" + path.basename(file));
      try {
        await fs.promises.access(outputFilePath); // Use fs.promises.access() for async operation
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } catch (error) {
        const fileContent = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
        const elements = JSON.parse(fileContent); // Parse the JSON content
        let sectionsMerged = "";
        let sectionsMergedToken = 0;
        // Assume we are limited to 8k context window
        const sectionsMergedMax = 7500;
        for (const element of elements) {
          const elementTokens = utils.stringTokens(element.text)
          // Probably too long to be related to TOC
          //if (elementTokens > 100) continue;
          //console.log("element.metadata.sectionCount", element.metadata.sectionCount);
          if (sectionsMergedToken + elementTokens > sectionsMergedMax) break;
          if (element.metadata.page_number) {
            sectionsMerged += "p." + element.metadata.page_number + ' ';
          }
          sectionsMerged += element.text + "\n";
          sectionsMergedToken += elementTokens;// has issues with element.metadata.tokenLength;
        }
        console.log(`extractTOC_async calling textToTOC_async for ${outputFilePath}`);
        const metadata = await textToTOC_async(sectionsMerged);
        //metadata["sectionsMerged"] = sectionsMerged;
        await fs.promises.writeFile(outputFilePath, JSON.stringify(metadata, null, 2));
      }
    }
  };

  const extractRegex_async = async (inputDir, outputDir) => {
    let files = await searchDirectory_async(inputDir);
    files = files.filter(file => path.basename(file).startsWith('TOC-'));
    for (const file of files) {
      const outputFilePath = path.join(outputDir, "Regex-" + path.basename(file));
      try {
        await fs.promises.access(outputFilePath); // Use fs.promises.access() for async operation
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } catch (error) {
        const toc = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
        console.log("Read TOC", toc);
        const regexs = await TOCRegexs_async(toc);
        console.log("Got Regex", regexs);
        await fs.promises.writeFile(outputFilePath, JSON.stringify(regexs, null, 2));
      }
    }
  };

  const buildTOC_async = async (inputDir, outputDir) => {
    let files = await searchDirectory_async(inputDir);
    for (const file of files) {
      const outputFilePath = path.join(outputDir, "GenTOC-" + path.basename(file));
      const regexFilePath = path.join(outputDir, "Regex-TOC-" + path.basename(file));
      try {
        await fs.promises.access(outputFilePath); // Use fs.promises.access() for async operation
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } catch (error) {
        let fileContent = await fs.promises.readFile(regexFilePath, 'utf-8'); // Read the file content as UTF-8 text
        const regex = JSON.parse(fileContent);
        console.log("Read regex", regex);
        fileContent = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
        const elements = JSON.parse(fileContent); // Parse the JSON content
        let tocElements = [];
        // Iterate over each element
        for (const element of elements) {
          // Check if the element has a 'text' property
          if (element.text) {
            // Iterate over each regex pattern
            for (const pattern of regex.Regex) {
              const regexPattern = new RegExp(pattern.Pattern);
              // Test if the element's 'text' property matches the regex pattern
              if (regexPattern.test(element.text)) {
                // Add the matching element to the TOC object
                tocElements.push("P." + element.metadata.page_number + ' id: ' + element.element_id + ' ' + element.text);
                break; // Break the loop for this element if a match is found
              }
            }
          }
        }
        console.log("tocElements", tocElements);
        console.log("outputFilePath", outputFilePath);
        // We probably don't want to use id as that is expensive for tokens - we can use the page number and list of elements with regex
        const genToc = await dataToTOC_async(tocElements);
        // now we want to generate the most likely structure
        await fs.promises.writeFile(outputFilePath, JSON.stringify(genToc, null, 2));
      }
    }
  };
  
  const vectorizeFiles_async = async (chunkedDir, vectorizedDir, nextDir) => {
    const files = await searchDirectory_async(chunkedDir);
    for (const file of files) {
      const vectorizedFilename = path.basename(file);
      const outputFilePath = path.join(vectorizedDir, vectorizedFilename);
  
      if (fs.existsSync(outputFilePath)) {
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } else {
        try {
          const fileContent = await fs.promises.readFile(file, 'utf-8');
          const elements = JSON.parse(fileContent);
          let weaviateData = stage_for_weaviate(elements);
  
          const batchSize = 100;
          console.log(`Vectorizing ${vectorizedFilename} with ${weaviateData.length} elements`);
  
          const progressBar = new SingleBar({
            format: 'Processing [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}',
            clearOnComplete: true,
          });
          
          const outputStream = fs.createWriteStream(outputFilePath, { flags: 'w' });
          progressBar.start(weaviateData.length, 0);
  
          for (let i = 0; i < weaviateData.length; i += batchSize) {
            const batch = weaviateData.slice(i, i + batchSize);
            const inputTextArray = batch.map((element) => element.text);
            const embeddings = await embedTextBatch_async(inputTextArray);
            
            for (let j = 0; j < batch.length; j++) {
              batch[j]["vector"] = embeddings[j];
              progressBar.update(i + j + 1);
              // Write each element as a separate line
              outputStream.write(JSON.stringify(batch[j]) + '\n');
            }

            // Log every 10th batch
            if ((i / batchSize) % 10 === 0) {
              console.log(`Processing batch ${(i / batchSize) + 1}/${Math.ceil(weaviateData.length / batchSize)} with ${batchSize} elements per batch`);
            } 
          }
  
          progressBar.stop();
          outputStream.end();
          console.log(`Vectorized data saved to ${outputFilePath}`);
  
          const nextFilename = path.basename(outputFilePath);
          await deleteNextFile(nextFilename, nextDir);
        } catch (error) {
          console.error(`Error reading file ${file}`, error);
        }
      }
    }
  }

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
    let itemsIngested = [];
    for (const item of data) {
      // Construct the object to add to the batch
      const itemWithoutVector = utils.deepClone(item);
      delete itemWithoutVector.vector;
      // In batch imports Weaviate will overwrite the same id
      let id;
      try {
        id = generateUuid5(JSON.stringify(itemWithoutVector));
      } catch (error) {
        console.error("Error generateUuid5:", error, "item:", item);
        throw new Error(`ingest_async Error generateUuid5`);
      }
      const obj = {
        class: className,
        properties: itemWithoutVector,
        vector: item.vector,
        id,
      }
      item["id"] = id;
      itemsIngested.push(item);
      //delete item.vector;
      //console.log(itemWithoutVector);
      // add the object to the batch queue
      batcher = batcher.withObject(obj);
      // When the batch counter reaches batchSize, push the objects to Weaviate
      if (counter++ % batchSize === 0) {
        // Flush the batch queue and restart it
        try {
          const batchResult = await batcher.do();
          if (!checkBatchResult(batchResult)) {
            throw new Error(`ingest_async failed to import batch`);
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
    return itemsIngested;
  }

  async function ingestVectorizedFile_async(filePath, ingestedDir, nextDir) {
    const fileName = path.basename(filePath);
    const outputFilePath = path.join(ingestedDir, fileName); 
    if (!fs.existsSync(outputFilePath)) {
        console.log(`Processing and ingesting file: ${filePath}`);
        const fileStream = fs.createReadStream(filePath);
        const outputStream = fs.createWriteStream(outputFilePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        let batch = [];
        const batchSize = 100; // Adjust the batch size as needed
        for await (const line of rl) {
            const element = JSON.parse(line); // Assuming each line is a JSON object
            batch.push(element);

            if (batch.length === batchSize) {
                const itemsIngested = await ingest_async(className, batch);
                // Write itemsIngested to file
                itemsIngested.forEach(item => outputStream.write(JSON.stringify(item) + '\n'));
                batch = [];
            }
        }
        // Process the last batch if it's not empty
        if (batch.length > 0) {
            const itemsIngested = await ingest_async(className, batch);
            // Write itemsIngested to file
            itemsIngested.forEach(item => outputStream.write(JSON.stringify(item) + '\n'));
        }
        // Close the write stream
        outputStream.end();
        console.log(`File written in ingested directory: ${outputFilePath}`);
        const nextFilename = path.basename(outputFilePath);
        await deleteNextFile(nextFilename, nextDir);
    } else {
        console.log(`File already exists in ingested directory: ${outputFilePath}. Skipping ingestion.`); 
    }
  }
  
  // Function to process all vectorized files in the directory
  async function ingestAllVectorizedFiles_async(vectorizedDir, ingestedDir, nextDir) {
    const files = fs.readdirSync(vectorizedDir);
    for (const file of files) {
      const filePath = path.join(vectorizedDir, file);
      await ingestVectorizedFile_async(filePath, ingestedDir, nextDir);
    }
  }

  async function getMetadata_async(metadata, element) {
    let result = {};
    if (!metadata[element.filename] && element.filename) {
      const jsonFileName = path.basename(element.filename).replace(/\.[^/.]+$/, '.json');
      const metadataFilePath = path.join(metadataDir, jsonFileName);
      //console.log("metadataFilePath", metadataFilePath);
      let elementMetadata;
      try {
        const metadataContent = await fs.promises.readFile(metadataFilePath, 'utf-8'); // Read the file content as UTF-8 text
        elementMetadata = JSON.parse(metadataContent); // Parse the JSON content
      } catch (error) {
        elementMetadata = {};
      }
      //console.log("elementMetadata", elementMetadata);
      metadata[element.filename] = elementMetadata;
      result = elementMetadata;
    } else if (element.filename) {
      result = metadata[element.filename];
    }
    return result;
  }

  function addReference(metadata, element) {
    if (!metadata?.title) {
      console.error("addReference", metadata);
    }
    let prefix = '';
    prefix += `The context below, starting with <BEGIN> and ending with <END> was extacted from <TITLE>"${metadata.title}"</TITLE>`;
    if (metadata.author) {
      prefix += ` authored by <AUTHOR>${metadata.author}</AUTHOR>`;
    }
    if (element?.metadata?.page_number) {
      prefix += ` on page <PAGE>${element.metadata.page_number}</PAGE>`;
    }
    prefix += "\n<BEGIN>\n";
    let postfix = "\n<END>\n"
    const context = "\n" + prefix + element.text + postfix;
    return context
  }

  async function addRelatedText_async(metadata, item) {
    // For each section find the most relevant chunks that are not in this section
    if (item.mergedSection && item.vector) {
      //console.log("Element:", element.title, element.text)
      let response;
      try {
        response = await client.graphql
          .get()
          .withClassName(className)
          .withFields('text tokenLength filename _additional {distance id}') 
          .withWhere({
            operator: "And",
            operands: [
              {
                path: ['mergedSection'],
                operator: 'Equal',
                valueBoolean: false,
              },
              // For this to work we needed to modify the tokenization of the title to "field"
              {
                path: ['title'],
                operator: 'NotEqual',
                valueText: item.title,
              },
            ],
          })
          .withNearVector({ 
            vector: item.vector,
            "distance": T("config.local.maxDistance") || 0.14,
          })
          .withAutocut(2)
          .withLimit(T("config.local.maxChunks") || 10)
          .do();
      } catch (error) {
        console.error("Error in specific part of the function:", error);
      }
      const responseElements = response?.data?.Get[className] || []
      let nearElements = [];
      for (const obj of responseElements) {
        if (obj._additional.distance < (T("config.local.maxDistance") || 0.14)) {
          nearElements.push(obj);
        }
      }
      if (nearElements && nearElements.length) {
        let tokens = item.tokenLength;
        // leave space for response
        const availableTokens = T("state.config.local.availableTokens") || 3000; 
        for (const nearElement of nearElements) {
          tokens += nearElement.tokenLength;
          if (tokens > availableTokens) {
            break;
          } else {
            const elementMetadata = await getMetadata_async(metadata, nearElement);
            // eslint-disable-next-line no-unused-vars
            const context = addReference(elementMetadata, nearElement)
            const newTokenLength = utils.stringTokens(context);
            item.text += "\n" + context;
            item.tokenLength = newTokenLength;
          }
        }
        //console.log("item", item);
        // We can get 404 errors here, probably need to batch the operations
        try {
          await client.data
            .merger()  // merges properties into the object
            .withId(item.id).withClassName(className)
            .withProperties({
              text: item.text,
              tokenLength: tokens,
            })
            .do();
            //console.log("Updated item:", item.id, "original tokenLength of", item.tokenLength, "now", tokens); 
        } catch (error) {
          //console.log(`addRelatedText_async id:${item.id} className:${className} text:${item.text} tokens:${tokens}`); 
          console.error("addRelatedText_async error:", error); 
        }
      }
    }
    return item;
  }

  // This is an expensive operation
  // If the number of duplicates is below some ratios then could stop (need to randomly order the elements)
  async function findDuplicates_async(item) {
    let response;
    try {
      response = await client.graphql
        .get()
        .withClassName(className)
        .withFields('text _additional {distance id}')
        .withWhere({
          path: ['id'],
          operator: 'NotEqual',
          valueText: item.id,
        })
        .withNearVector({ 
          vector: item.vector,
          distance: 0.01,
        })
        .do();
    } catch (error) {
      console.error("Error findDuplicates_async getting nearest:", error, item); 
    }
    const responseElements = response?.data?.Get[className] || []
    let duplicateIds = [];
    for (const obj of responseElements) {
      //console.log("Duplicate", element._additional.id, "with", obj._additional.id, "distance", obj._additional.distance);
      if (duplicateIds.includes(obj._additional.id)) {
        console.log("Duplicate already found", obj._additional.id);
        continue;
      }
      try {
        await client.data
          .deleter()
          .withClassName(className)
          .withId(obj._additional.id)
          .do();
        duplicateIds.push(obj._additional.id);
      } catch (error) {
        console.error("Error findDuplicates_async deleting:", error);
      }
    }
    if (duplicateIds.length) {
      console.log(`Deleted ${duplicateIds.length} duplicates ${duplicateIds} of element ${item.id}`);
    }
    return duplicateIds;
  }

  // eslint-disable-next-line no-unused-vars
  async function getBatchWithCursor(className, classProperties, batchSize, cursor) {
    const query = client.graphql.get()
      .withClassName(className)
      // Optionally retrieve the vector embedding by adding `vector` to the _additional fields
      .withFields(classProperties.join(' ') + ' _additional { id vector }')
      .withLimit(batchSize);
    if (cursor) {
      return await query.withAfter(cursor).do();
    } else {
      return await query.do();
    }
  }

  const dataProcessEmbeddings_async = async (inputDir, outputDir) => {
    const files = await searchDirectory_async(inputDir);
    for (const file of files) {
      const outputFilePath = path.join(outputDir, path.basename(file));
      try {
        await fs.promises.access(outputFilePath);
        console.log(`File ${outputFilePath} already exists. Skipping.`);
      } catch (error) {
        console.log(`Processing file: ${file}`);
        const fileStream = fs.createReadStream(file);
        const outputStream = fs.createWriteStream(outputFilePath);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });
        let duplicateIds = [];
        let items = [];
        let i = 0;
        for await (const line of rl) {
          const item = JSON.parse(line); // Assuming each line is a JSON object representing an item
          const newDuplicateIds = await findDuplicates_async(item);
          duplicateIds = duplicateIds.concat(newDuplicateIds);
          items.push(item);
          i++;
          // log every 1000th element
          if (i % 1000 === 0) {
            console.log(`dataProcessEmbeddings_async duplicates processed ${i} items`);
          }
        }

        let metadata = {};
        i = 0;
        for (let item of items) {
          if (!duplicateIds.includes(item.id)) {
            item = await addRelatedText_async(metadata, item);
            delete item.vector;
            outputStream.write(JSON.stringify(item) + '\n');
          }
          i++;
          // log every 1000th element
          if (i % 1000 === 0) {
            console.log(`dataProcessEmbeddings_async addRelatedText_async ${i} items`); 
          }
        }
  
        outputStream.end();
        console.log(`File ${outputFilePath} has been created.`);
      }
    }
  };
  
  const corpusDir = path.join(NODE.storage.dataDir, "RAG", T("shared.corpusName"));
  const pdfDir = path.join(corpusDir, 'pdf');
  const txtDir = path.join(corpusDir, 'txt');
  const metadataDir = path.join(corpusDir, 'metadata');
  const unstructuredDir = path.join(corpusDir, 'unstructured');
  const chunkedDir = path.join(corpusDir, 'chunked');
  const dataProcessedChunksDir = path.join(corpusDir, 'dataProcessedChunks');
  const vectorizedDir = path.join(corpusDir, 'vectorized');
  const ingestedDir = path.join(corpusDir, 'ingested');
  const dataProcessedEmbeddingsDir = path.join(corpusDir, 'dataProcessedEmbeddings');
  const className = T("shared.corpusName");
  const inputDirectories = [pdfDir, txtDir];
  const outputDirectories = [metadataDir, unstructuredDir, chunkedDir, dataProcessedChunksDir, vectorizedDir, ingestedDir, dataProcessedEmbeddingsDir];

  let nextState = T("state.current");
  while (!T("command") && nextState) {
    T("state.current", nextState);
    nextState = null;
    switch (T("state.current")) {
      case "start": {
        // Create the directory structure
        for (const dirPath of [...inputDirectories, ...outputDirectories]) {
          if (!fs.existsSync(dirPath)){
            console.log("Creating directory: " + dirPath);
            fs.mkdir(dirPath, { recursive: true }, (err) => {
              if (err) throw err;
            });
          }
        }
        //nextState = "restart"; // Will recreate all data in the corpus
        nextState = "parse";
        break;
      }
      case "parse": {
        await unstructuredFiles_async(pdfDir, unstructuredDir, chunkedDir);
        await unstructuredFiles_async(txtDir, unstructuredDir, chunkedDir);
        nextState = "chunk";
        break;
      }
      case "chunk": {
        //await extractTOC_async(unstructuredDir, metadataDir);
        await chunkFiles_async(unstructuredDir, chunkedDir, dataProcessedChunksDir);
        nextState = "extractMetadata";
        break;
      }
      case "extractMetadata": {
        await extractMetadata_async(dataProcessedChunksDir, metadataDir);
        await extractTopics_async(metadataDir);
        nextState = "dataProcessChunks";
        break;
      }
      case "dataProcessChunks": {
        await dataProcessChunks_async(chunkedDir, dataProcessedChunksDir, vectorizedDir);
        nextState = "vectorize";
        break;
      }
      case "vectorize": {
        await vectorizeFiles_async(dataProcessedChunksDir, vectorizedDir, ingestedDir);
        nextState = "ingest";
        break;
      }
      case "ingest": {
        // Check if the ingest dir is empty
        const files = await searchDirectory_async(ingestedDir);
        let reloadAll = false;
        if (files.length === 0) {
          // Assume we want to delete the data
          reloadAll = true;
        }
        // This is completely removing the data
        // Instead we should just add if the class already exists
        const classObj = createUnstructuredWeaviateClass(className);
        let exists = await client
          .schema
          .exists(className)
        console.log("Class exists ", className, exists);
        let currentClassObj;
        if (exists) {
          currentClassObj = await client
            .schema
            .classGetter()
            .withClassName(className)
            .do();
          for (const prop of currentClassObj.properties) {
            // Does it exist in classObj
            let match = false;
            for (const newProp of classObj.properties) {
              if (newProp.name === prop.name && 
                JSON.stringify(newProp.dataType) === JSON.stringify(prop.dataType)
              ) {
                match = true;
                break;
              }
            }
            if (!match || reloadAll) {
              console.log("Deleting class could not find prop or reloadAll", reloadAll, className, prop);
              await client.schema.classDeleter().withClassName(className).do();
              exists = false;
              break;
            }
          }
        }
        if (!exists) {
          await client.schema.classCreator().withClass(classObj).do();
          console.log(`Created class ${className} in Weaviate.`);
          // delete all ingested files
          const files = await searchDirectory_async(ingestedDir);
          for (const file of files) {
            await fsPromises.unlink(file);
          }
        }
        //console.log("currentClassObj", currentClassObj.properties);
        //console.log("classObj", classObj.properties);
        //console.log(`Created schema ${utils.js(classObj)} in Weaviate.`);
        // Process all vectorized files one by one
        await ingestAllVectorizedFiles_async(vectorizedDir, ingestedDir, dataProcessedEmbeddingsDir);
        const resp = await client.graphql
          .aggregate()
          .withClassName(className)
          .withFields('meta { count }')
          .do();
        console.log(JSON.stringify(resp, null, 2));
        nextState = "dataProcessEmbeddings";
        break;
      }
      case "dataProcessEmbeddings": {
        // Using vectorizedDir because this has the vectors but runs after state ingest because operating on the DB
        await dataProcessEmbeddings_async(ingestedDir, dataProcessedEmbeddingsDir);
        T("state.current", "done");
        T("command", "update");
        break;
      }
      case "done":
        break;
      case "deleteCache": {
        try {
          await client.batch
            .objectsBatchDeleter()
            .withClassName(className)
            .withWhere({
              path: ['title'],
              operator: 'Equal',
              valueText: 'TASKFLOW-CACHE',
            })
            .do();
        } catch (error) {
          console.error("Error deleteCache :", error); 
        }
        break;
      }
      case "debug": {
        await extractTOC_async(unstructuredDir, metadataDir);
        await extractRegex_async(metadataDir, metadataDir);
        await buildTOC_async(unstructuredDir, metadataDir);
        const unstructuredFiles = await searchDirectory_async(unstructuredDir);
        for (const file of unstructuredFiles) {
          if (!file.includes("Nuls")) continue;
          const fileContent = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
          const elements = JSON.parse(fileContent); // Parse the JSON content
          let elementLookup = {};
          for (const element of elements) {
            const baseId = element.element_id;
            elementLookup[baseId] = element;
          }
          // Get the TOC
          const genTOCFilePath = path.join(metadataDir, "GenTOC-" + path.basename(file));
          const genTOCfileContent = await fs.promises.readFile(genTOCFilePath, 'utf-8'); // Read the file content as UTF-8 text
          const genTOC = JSON.parse(genTOCfileContent); // Parse the JSON content
          for (const title of genTOC["TOC"]) {
            console.log(elementLookup[title.id].metadata.page_number, elementLookup[title.id].text);
          }
        }
        break;
        // eslint-disable-next-line no-unreachable
        const resp = await client.graphql
          .aggregate()
          .withClassName(className)
          .withFields('meta { count }')
          .do();
        console.log(JSON.stringify(resp, null, 2));
        const files = await searchDirectory_async(unstructuredDir);
        for (const file of files) {
          if (!file.includes("Nuls")) continue;
          const outputFilePath = path.join(chunkedDir, path.basename(file));
          console.log(`File ${outputFilePath} does not exist. Processing...`);
          const fileContent = await fs.promises.readFile(file, 'utf-8'); // Read the file content as UTF-8 text
          const elements = JSON.parse(fileContent); // Parse the JSON content
          console.log(`Unstructured ${elements.length} elements`);
          let elementLookup = {};
          let counter = 0; // Initialize a counter
          let idMapping = {}; // Dictionary to map original IDs to new unique IDs
          let lastTitleId = null; // Keep track of the last processed title ID
          
          for (const element of elements) {
            const baseId = element.element_id;
            const uniqueId = `${baseId}-${counter}`; // Append the counter to the base ID
            idMapping[baseId] = uniqueId; // Map the base ID to the new unique ID
            counter++; // Increment the counter for the next element
          
            elementLookup[uniqueId] = {
              id: uniqueId,
              type: element.type,
              text: element.text,
              page: element.metadata.page_number,
            };
          
            if (element.metadata.parent_id) {
              // Use the mapping to find the correct unique parent ID
              const parentBaseId = element.metadata.parent_id;
              const parentUniqueId = idMapping[parentBaseId];
              elementLookup[uniqueId].parent_id = parentUniqueId;
            } else if (element.type === 'Title' && lastTitleId !== null) {
              // If the element is a title and follows another title without a parent_id
              elementLookup[uniqueId].parent_id = lastTitleId;
              //console.log("Adding Parent ID:", elementLookup[uniqueId].parent_id);
            }
          
            // Update the lastTitleId if the current element is a title
            if (element.type === 'Title') {
              lastTitleId = uniqueId;
            } else {
              lastTitleId = null;
            }
          }
          
          // Now, elementLookup contains elements with updated parent-child relationships
          // You can proceed to build and display the tree as before
          
          // Build and display the tree
          // eslint-disable-next-line no-unused-vars
          const hierarchyTree = buildTree(elementLookup);
          //console.log("Hierarchy Tree:", JSON.stringify(hierarchyTree, null, 2));
          printCompactHierarchy(elementLookup, hierarchyTree);
        }
        break;
      }
      case "restart": {
        const files = await searchDirectory_async(pdfDir);
        for (const file of files) {
          const filesToDelete = [];
          const jsonFileName = path.basename(file).replace(/\.[^/.]+$/, '.json');
          for (const dirPath of outputDirectories) {
            filesToDelete.push(path.join(dirPath, jsonFileName));
          }
          // Create an array of promises, one for each file deletion operation
          const deletionPromises = filesToDelete.map(filePath => {
            return fsPromises.unlink(filePath)
              .then(() => {
                console.log(`File ${filePath} deleted successfully`);
              })
              .catch((error) => {
                console.error(`Error deleting file ${filePath}:`, error.message);
              });
          })
          // Wait for all deletion operations to complete
          Promise.all(deletionPromises)
            .then(() => {
              console.log('All files deleted successfully');
            })
            .catch((error) => {
              console.error('An error occurred:', error.message);
            });
          console.log("Deleting class", className);
          await client.schema.classDeleter().withClassName(className).do();
        }
        nextState = "parse";
        break;
      }
      default:
        console.log("WARNING unknown state : " + T("state.current"));
    }
    // The while loop can move to next state by assigning nextState
    if (nextState) {
      console.log(`nextState ${nextState}`);
    } else {
      console.log(`command ${T("command")}`);
    }
  }

  return T();
};

export { TaskRAGPreprocessing_async };

// Function to build a tree from the element lookup
function buildTree(elementLookup) {
  const tree = {};
  const childrenOf = {};
  const hasChildren = {};

  // Initialize childrenOf for each element and mark elements with children
  Object.keys(elementLookup).forEach(id => {
    childrenOf[id] = [];
    hasChildren[id] = false;
  });

  // Populate children for each element and update hasChildren
  Object.keys(elementLookup).forEach(id => {
    const parent_id = elementLookup[id].parent_id;
    if (parent_id) {
      childrenOf[parent_id].push({ id });
      hasChildren[parent_id] = true;
    }
  });

  // Sort children by page number
  Object.keys(childrenOf).forEach(parent_id => {
    childrenOf[parent_id].sort((a, b) => a.page - b.page);
  });

  // Adjust root identification logic based on hasChildren
  Object.keys(elementLookup).forEach(id => {
    if (!elementLookup[id].parent_id && hasChildren[id]) {
      tree[id] = elementLookup[id];
    }
  });

  // Recursively build the tree and calculate depths
  let totalNodes = 0;
  let maxDepth = 0;
  let totalDepth = 0;
  let minPage = Infinity;
  let maxPage = -Infinity;
  let totalPage = 0;

  function buildBranch(branch, depth = 0) {
    if (!childrenOf[branch.id]) {
      return;
    }

    totalNodes++;
    totalDepth += depth;
    maxDepth = Math.max(maxDepth, depth);

    if (branch.page !== undefined) {
      minPage = Math.min(minPage, branch.page);
      maxPage = Math.max(maxPage, branch.page);
      totalPage += branch.page;
    }

    branch.children = childrenOf[branch.id];
    branch.children.forEach(child => buildBranch(child, depth + 1));
  }

  Object.keys(tree).forEach(id => buildBranch(tree[id]));

  // Calculate statistics
  const numRootNodes = Object.keys(tree).length;
  const avgDepth = totalDepth / totalNodes;
  let maxChildren = 0;
  let totalChildren = 0;

  Object.values(childrenOf).forEach(children => {
    maxChildren = Math.max(maxChildren, children.length);
    totalChildren += children.length;
  });
  const avgChildren = totalChildren / totalNodes;
  const avgPage = totalPage / totalNodes;

  // Log statistics
  console.log(`Total Number of Nodes: ${totalNodes}`);
  console.log(`Number of Root Nodes: ${numRootNodes}`);
  console.log(`Maximum Depth of the Tree: ${maxDepth}`);
  console.log(`Average Depth of Nodes: ${avgDepth.toFixed(2)}`);
  console.log(`Maximum Children Count: ${maxChildren}`);
  console.log(`Average Children Count: ${avgChildren.toFixed(2)}`);
  console.log(`Page Range: ${minPage} to ${maxPage}`);
  console.log(`Average Page Number: ${avgPage.toFixed(2)}`);

  return tree;
}

function printCompactHierarchy(elementLookup, tree, depth = 0) {
  Object.values(tree).forEach(node => {
    if (node.children && node.children.length > 0) {
      // Print the node only if it has children
      const element = elementLookup[node.id];
      //console.log(' '.repeat(depth * 2) + node.id + ' ' + node.children.length + ' ' + element.text);
      console.log(' '.repeat(depth * 2) + ' ' + element.text + " p." + element.page );
      // Recursively print the children, increasing the depth for indentation
      printCompactHierarchy(elementLookup, node.children, depth + 1);
    }
  });
}