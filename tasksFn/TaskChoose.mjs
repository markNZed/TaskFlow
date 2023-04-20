import { TaskFromAgent_async } from './TaskFromAgent.mjs';
import * as tf from '@tensorflow/tfjs-node';
import * as use from '@tensorflow-models/universal-sentence-encoder';

const model = await use.load();

const cosineSimilarity = (tensor1, tensor2) => {
  const negativeCosineSimilarity = tf.metrics.cosineProximity(tensor1, tensor2);
  return negativeCosineSimilarity.mul(-1).dataSync()[0];
};

const TaskChoose_async = async function(threadsStore_async, instancesStore_async, chat_callback_async, task) {
    // First we get the response
    console.log("TaskChoose task.name " + task.name)
  
    task.response = null // Avoid using previously stored response
    let subtask = await TaskFromAgent_async(threadsStore_async, instancesStore_async, chat_callback_async, task) 
  
    const next_responses = Object.keys(task.next_template)
    const next_states = Object.values(task.next_template)
    
    const phrases = [subtask.response, ...next_responses];
    
    try {
      const embeddingsData = await model.embed(phrases);
      const next_embeddings = tf.split(embeddingsData, phrases.length, 0);
      // Do something with next_embeddings
      const response_embedding = next_embeddings[0]; // The first embedding corresponds to response_text.
  
      const similarities = [];
    
      for (let i = 1; i < next_embeddings.length; i++) {
        const similarity = cosineSimilarity(response_embedding, next_embeddings[i]);
        similarities.push(similarity);
      }
    
      console.log('Similarities:', similarities);
    
      const maxSimilarity = Math.max(...similarities);
      const maxIndex = similarities.indexOf(maxSimilarity);
    
      console.log('Max similarity:', maxSimilarity);
      console.log('Index of max similarity:', maxIndex);
    
      console.log('response is' + next_states[maxIndex])
    
      // Remember to clean up tensors to prevent memory leaks
      embeddingsData.dispose();
    
      // Need to go to next state, can stay on server side
      task.next = next_states[maxIndex]
      task.done = true
  
    } catch (error) {
      // Handle the error here
      console.error('An error occurred:', error);
      task.error = error.message
    }
    
    return task
  
}

export { TaskChoose_async }