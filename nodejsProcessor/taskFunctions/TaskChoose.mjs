/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { TaskFromAgent_async } from "./TaskFromAgent.mjs";
import * as tf from "@tensorflow/tfjs-node";
import * as use from "@tensorflow-models/universal-sentence-encoder";
import { utils } from "../src/utils.mjs";

const model = await use.load();

const cosineSimilarity = (tensor1, tensor2) => {
  const negativeCosineSimilarity = tf.metrics.cosineProximity(tensor1, tensor2);
  return negativeCosineSimilarity.mul(-1).dataSync()[0];
};

const TaskChoose_async = async function (task) {
  const T = utils.createTaskValueGetter(task);

  // First we get the response
  console.log("TaskChoose name " + T("name"));

  // This is not going to work because TaskFromAgent_async is returning immediately
  T("response.text", null); // Avoid using previously stored response
  let subtask = await TaskFromAgent_async(task);

  const ST = utils.createTaskValueGetter(subtask);

  const next_responses = Object.keys(T("config.nextStateTemplate"));
  const next_states = Object.values(T("config.nextStateTemplate"));

  const phrases = [ST("response.text"), ...next_responses];

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

    console.log("Similarities:", similarities);

    const maxSimilarity = Math.max(...similarities);
    const maxIndex = similarities.indexOf(maxSimilarity);

    console.log("Max similarity:", maxSimilarity);
    console.log("Index of max similarity:", maxIndex);

    console.log("response is" + next_states[maxIndex]);

    // Remember to clean up tensors to prevent memory leaks
    embeddingsData.dispose();

    // Need to go to next state, can stay on nodejsProcessor side
    T("nextTask", next_states[maxIndex]);
    T("state.done", true);
  } catch (error) {
    // Handle the error here
    console.log("An error occurred:", error);
    T("error", error.message);
    const strArr = task.id.split('.');
    strArr[strArr.length - 1] = "error";
    const nextTask = strArr.join('.');
    T("nextTask", nextTask);
    // New task will not have error information
    T("state.done", true);
  }

  return task;
};

export { TaskChoose_async };
