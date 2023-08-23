#!/bin/bash

echo $V
quicktype --lang js --src-lang schema -o task${V}Converter.mjs task${V}Schema.json

# Create a temporary file and apply all sed modifications to it
tmp_file=$(mktemp)

sed 's/module\.exports = {/export {/' task${V}Converter.mjs > "$tmp_file"
sed -e "s/task${V}ConverterToJson/taskConverterToJson/g" \
    -e "s/toTask${V}Converter/toTaskConverter/g" \
    -e "s/Task${V}Converter/TaskConverter/g" \
    -e 's/"taskConverterToJson": //' \
    -e 's/"toTaskConverter": //' "$tmp_file" > task${V}Converter.mjs

# Clean up temporary file
rm "$tmp_file"

