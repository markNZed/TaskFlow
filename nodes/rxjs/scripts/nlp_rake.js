#!/usr/bin/env node

import rake from 'node-rake';

const text = `To rewrite the given code in ES6 (ECMAScript 6) style, you would primarily use import statements for module imports and arrow functions instead of traditional function expressions. Here's how the code can be transformed:`;

// Extract keywords using rake
const keywords = rake.generate(text);

// If you still want to limit to top 6 terms, you can slice the array
const topTerms = keywords.slice(0, 6);

console.log('Compressed Summary:', topTerms.join(', '));
