#!/usr/bin/env node

import natural from 'natural';

const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();

tfidf.addDocument(`To rewrite the given code in ES6 (ECMAScript 6) style, you would primarily use import statements for module imports and arrow functions instead of traditional function expressions. Here's how the code can be transformed:`);

/*
tfidf.listTerms(0).forEach((item) => {
    console.log(item.term); // This will log the terms in the document
});
*/

// Extract top 6 terms
const topTerms = tfidf.listTerms(0 /* document index */)
                       .slice(0, 6) // Get only the top 6 terms
                       .map(term => term.term);

console.log('Compressed Summary:', topTerms.join(', '));