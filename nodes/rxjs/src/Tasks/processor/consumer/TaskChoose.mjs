/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import * as tf from "@tensorflow/tfjs-node";
import * as use from "@tensorflow-models/universal-sentence-encoder";
import path from "path";
import { fileURLToPath } from "url";

const model = await use.load();

const cosineSimilarity = (tensor1, tensor2) => {
  const negativeCosineSimilarity = tf.metrics.cosineProximity(tensor1, tensor2);
  return negativeCosineSimilarity.mul(-1).dataSync()[0];
};

// eslint-disable-next-line no-unused-vars
const TaskChoose_async = async function (wsSendTask, T, FSMHolder, CEPMatchMap) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  // Two approaches to choosing the next task
  // By function or by LLM
  // config.local.withFunction
  //   TaskIntetrviewChoose that exports choose

  if (T("config.local.withFunction")) {
    try {
      // Ensure that the config value is a valid string
      const functionName = T("config.local.withFunction");
      if (typeof functionName !== 'string' || functionName.trim() === '') {
        throw new Error("Invalid function name in config");
      }
      // Construct the module path
      let currDir = path.dirname(fileURLToPath(import.meta.url));
      const modulePath = currDir + "/" + functionName + ".mjs";
      console.log("Attempting to import module from:", modulePath);
      // Attempt to import the module
      const module = await import(modulePath);
      // Check if the module has the 'choose' function
      const chooseFn = module["choose"];
      if (typeof chooseFn === 'function') {
        return chooseFn(T);
      } else {
        throw new Error(`'choose' function not found in the module: ${functionName}`);
      }
    } catch (error) {
      // Handle any errors that occur during import
      console.error("Error during dynamic import:", error.message);
      T("error", {message: `Dynamic import failed: ${error.message}`});
    }
  }
  
  const operators = T("operators");
  const operatorLLM = operators["LLM"].module;

  T("response.LLM", null); // Avoid using previously stored response
  const operatorOut = await operatorLLM.operate_async(wsSendTask, T());
  T("response.LLM", operatorOut.response.LLM);

  const nextTaskKeys = Object.keys(T("config.nextTaskTemplate"));
  const nextTaskIds = Object.values(T("config.nextTaskTemplate"));

  const phrases = [T("response.LLM"), ...nextTaskKeys];

  //console.log("phrases", phrases)

  try {
    const embeddingsData = await model.embed(phrases);
    const next_embeddings = tf.split(embeddingsData, phrases.length, 0);
    //console.log("next_embeddings", next_embeddings)
    // Do something with next_embeddings
    const response_embedding = next_embeddings[0]; // The first embedding corresponds to response_text.

    const similarities = [];

    for (let i = 1; i < next_embeddings.length; i++) {
      const similarity = cosineSimilarity(
        response_embedding,
        next_embeddings[i]
      );
      similarities.push(similarity);
    }

    //console.log("Similarities:", similarities);

    const maxSimilarity = Math.max(...similarities);
    const maxIndex = similarities.indexOf(maxSimilarity);

    console.log("Max similarity:", maxSimilarity);
    console.log("Index of max similarity:", maxIndex);

    console.log("response is" + nextTaskIds[maxIndex]);

    // Remember to clean up tensors to prevent memory leaks
    embeddingsData.dispose();

    // Need to go to next state, can stay on RxJS Processor Consumer side
    T("commandArgs", {"nextTaskId": nextTaskIds[maxIndex], "done": true});
    T("command", "update");
    T("commandDescription", "Transition to next task:" + nextTaskIds[maxIndex]);
  } catch (error) {
    // Handle the error here
    console.log("An error occurred:", error);
    T("error", error);
  }

  return T();
};

export { TaskChoose_async };
