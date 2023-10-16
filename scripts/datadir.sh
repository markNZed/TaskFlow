#!/bin/bash

# Get the directory of the currently executing script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

mkdir -p "$DIR/../data/rag/corpus/pdf"
mkdir -p "$DIR/../data/rag/corpus/parsed"
mkdir -p "$DIR/../data/rag/corpus/vectorized"
mkdir -p "$DIR/../data/rag/corpus/ingested"
mkdir -p "$DIR/../data/rag/training"
mkdir -p "$DIR/../data/rag/validation"
mkdir -p "$DIR/../data/rag/test"

touch "$DIR/../data/rag/training/questions.json"
touch "$DIR/../data/rag/training/answers.json"
touch "$DIR/../data/rag/validation/questions.json"
touch "$DIR/../data/rag/validation/answers.json"
touch "$DIR/../data/rag/test/questions.json"
touch "$DIR/../data/rag/test/answers.json"

