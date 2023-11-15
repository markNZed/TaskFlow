#!/usr/bin/env node

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const configuration = {
  apiKey: OPENAI_API_KEY,
};
const openai = new OpenAI(configuration);

async function embedText_async(inputText) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: inputText,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(error);
  }
}

// Helper Functions for Vector Operations
function initializeZeroVector(length) {
  return new Array(length).fill(0);
}

function addVectors(vec1, vec2) {
  return vec1.map((val, idx) => val + vec2[idx]);
}

function dot(vec1, vec2) {
  return vec1.reduce((acc, val, idx) => acc + val * vec2[idx], 0);
}

function magnitude(vec) {
  return Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0));
}

function divideVector(vec, divisor) {
  return vec.map(val => val / divisor);
}

// Function to calculate the centroid of embeddings
// eslint-disable-next-line no-unused-vars
async function calculateCentroid(embeddings) {
  let centroid = initializeZeroVector(embeddings[0].length);
  for (let embedding of embeddings) {
    centroid = addVectors(centroid, embedding);
  }
  centroid = divideVector(centroid, embeddings.length);
  return centroid;
}

// Function to calculate cosine similarity between two vectors
function cosineSimilarity(vec1, vec2) {
  let dotProduct = dot(vec1, vec2);
  let magnitudeVec1 = magnitude(vec1);
  let magnitudeVec2 = magnitude(vec2);
  return dotProduct / (magnitudeVec1 * magnitudeVec2);
}

// Function to normalize similarity scores
function normalizeSimilarity(score, centroidSimilarity) {
  return (score - centroidSimilarity) / (1 - centroidSimilarity);
}

// Main function to process queries
async function processQueries() {

  /*
  // The smalltalk vs serious seems to work quite well
  const a = "smallTalk";
  const aQueries = [
    "How's the weather today?",
    "What are some good movies you've seen recently?",
    "Can you recommend any good restaurants nearby?",
    "What hobbies do you enjoy in your free time?",
    "How was your weekend?",
    "Do you follow any sports teams?",
    "What's your favorite kind of music?",
    "Have you read any good books lately?",
    "What are popular vacation spots this year?",
    "How do you usually relax after a long day?"
  ];

  const b = "serious";
  const bQueries = [
    "What are the leading causes of climate change?",
    "Can you explain the impact of AI on job markets?",
    "What are the ethical implications of genome editing?",
    "How does the electoral college work in the U.S. presidential election?",
    "What steps can be taken to achieve sustainable agriculture?",
    "How do vaccines work to prevent diseases?",
    "What are the economic effects of global pandemics?",
    "Can you discuss the history of the European Union?",
    "What are the latest developments in renewable energy technologies?",
    "How does the human brain process and store memories?"
  ];

  const testQueries = [
    "What are some easy ways to stay fit and healthy?",
    "Can you tell me more about the Mars Rover missions?",
    "Do you have any tips for learning a new language?",
    "What are the implications of quantum computing on data security?"
  ];

  */

  /*

  // This does not seem to work well

  const a = "continuation";
  const aQueries = [
    "How might this affect global energy policies in the next decade?",
    "Can you give an example of natural selection in a specific animal species?",
    "How did Keynesian economics influence post-World War II fiscal policies?",
    "Are there specific health risks for children versus adults?",
    "Which of these laws is most critical in understanding energy conservation?",
    "What are the technological limitations currently hindering missions to Mars?",
    "Can you provide examples of AI applications in diagnosing diseases?",
    "How did the Industrial Revolution alter social and economic structures?",
    "Does quantum entanglement have any practical applications in computing?",
    "What are some effective dietary changes to reduce heart disease risk?"
  ];

  const b = "initial";
  const bQueries = [
    "What factors contribute to the rise of renewable energy sources?",
    "What is the process of natural selection in evolutionary biology?",
    "What are the fundamental principles of Keynesian economics?",
    "What are the health implications of prolonged exposure to screen time?",
    "Can you describe the basic laws of thermodynamics?",
    "What are the critical challenges facing deep space exploration?",
    "How is artificial intelligence being integrated in healthcare?",
    "What were the major causes and effects of the Industrial Revolution?",
    "What is the significance of quantum entanglement in modern physics?",
    "How do dietary choices impact cardiovascular health?"
  ];
  
  const testQueries = [
    "What role do oceans play in regulating global climate?",
    "Following that, how does ocean acidification affect marine biodiversity?",
    "What are the ethical implications of gene editing technologies?",
    "In that context, how is CRISPR technology being regulated internationally?"
  ];

  */

  // This seems to work OK

  const a = "open"
  const aQueries = [
    "How might the rise of renewable energy sources affect global geopolitics in the next 50 years?",
    "What are the potential ethical dilemmas posed by genetic engineering in humans?",
    "In what ways can art influence social change and public opinion?",
    "How could the concept of work-life balance evolve with the increasing automation of industries?",
    "What are the possible effects of space exploration on international collaboration and conflict?",
    "How might virtual reality change our perception of reality and social interactions in the future?",
    "In what ways could quantum computing revolutionize data security and cryptography?",
    "What are the long-term implications of social media on mental health and community building?",
    "How could urban planning evolve to accommodate the needs of rapidly growing populations?",
    "What are the potential impacts of artificial intelligence on creative industries like music and art?"
  ];

  const b = "close";
  const bQueries = [
    "What is the freezing point of water in degrees Fahrenheit?",
    "Who wrote the novel '1984'?",
    "What is the capital of Japan?",
    "What is the primary chemical composition of the Earth's atmosphere?",
    "In what year did the Apollo 11 mission land on the moon?",
    "What is the molecular formula of glucose?",
    "Who was the first woman to win a Nobel Prize?",
    "What is the speed of light in a vacuum in meters per second?",
    "What element has the atomic number 6?",
    "Who is known as the 'Father of Computer Science'?"
  ];

  let testQueries = [
      "What could be the long-term impacts of virtual reality technology on education and training?",
      "What is the boiling point of water at sea level in degrees Celsius?",
      "Who wrote the novel '1984'?",
      "What is the capital of Japan?",
      "What is the primary chemical composition of the Earth's atmosphere?",
      "In what year did the Apollo 11 mission land on the moon?",
      "What is the molecular formula of glucose?",
      "Who was the first woman to win a Nobel Prize?",
      "What is the speed of light in a vacuum in meters per second?",
      "What element has the atomic number 6?",
      "Who is known as the 'Father of Computer Science'?",
      "How might the rise of renewable energy sources affect global geopolitics in the next 50 years?",
      "What are the potential ethical dilemmas posed by genetic engineering in humans?",
      "In what ways can art influence social change and public opinion?",
      "How could the concept of work-life balance evolve with the increasing automation of industries?",
      "What are the possible effects of space exploration on international collaboration and conflict?",
      "How might virtual reality change our perception of reality and social interactions in the future?",
      "In what ways could quantum computing revolutionize data security and cryptography?",
      "What are the long-term implications of social media on mental health and community building?",
      "How could urban planning evolve to accommodate the needs of rapidly growing populations?",
      "What are the potential impacts of artificial intelligence on creative industries like music and art?",
  ];


  let aEmbeddings = [];
  for (let query of aQueries) {
    aEmbeddings.push(await embedText_async(query));
  }

  let bEmbeddings = [];
  for (let query of bQueries) {
    bEmbeddings.push(await embedText_async(query));
  }

  
  let aCentroid = await calculateCentroid(aEmbeddings);
  let bCentroid = await calculateCentroid(bEmbeddings);

  let centroidSimilarity = cosineSimilarity(aCentroid, bCentroid);
  console.log("Centroid Similarity (Closeness):", centroidSimilarity);
  

  // Main Function to Process Embeddings

  for (let question of testQueries) {
    let embedding = await embedText_async(question);
    let similarityWithOpen = cosineSimilarity(embedding, aCentroid);
    let similarityWithClose = cosineSimilarity(embedding, bCentroid);

    // Normalize the similarities
    let normalizedSimilarityWithOpen = normalizeSimilarity(similarityWithOpen, centroidSimilarity);
    let normalizedSimilarityWithClose = normalizeSimilarity(similarityWithClose, centroidSimilarity);

    // Calculate the absolute difference
    let relativeDifference = Math.abs(similarityWithOpen - similarityWithClose) / (1 - centroidSimilarity);

    console.log(`Question: ${question}`);
    console.log("Similarity with a Centroid:", similarityWithOpen);
    console.log("Similarity with b Centroid:", similarityWithClose);
    console.log("Normalized Similarity with a Centroid:", normalizedSimilarityWithOpen);
    console.log("Normalized Similarity with b Centroid:", normalizedSimilarityWithClose);
    console.log("Relative Difference:", relativeDifference, " in favor of ", similarityWithOpen > similarityWithClose ? a : b);
    console.log();
  }

}

// Run the main function
processQueries();
