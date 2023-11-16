#!/usr/bin/env node

import nlp from 'compromise';

const text = `To rewrite the given code in ES6 (ECMAScript 6) style, you would primarily use import statements for module imports and arrow functions instead of traditional function expressions. Here's how the code can be transformed:`;

const doc = nlp(text);

// Extract nouns and named entities
const nouns = doc.nouns().out('array');
const namedEntities = doc.topics().out('array');

// Combine and filter out common words or less relevant terms
const allKeywords = [...nouns, ...namedEntities];
const filteredKeywords = allKeywords.filter(keyword => keyword.length > 3); // Simple length-based filter

// Take the top 6 terms
const topKeywords = filteredKeywords.slice(0, 6);

console.log('Compressed Summary:', topKeywords.join(', '));
