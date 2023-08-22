#!/bin/bash

echo $V
quicktype --lang js --src-lang schema -o task${V}Converter.mjs task${V}Schema.json
# Need to use -i.bak may be related to https://riptutorial.com/sed/example/22784/in-place-editing-without-specifying-a-backup-file-overrides-read-only-permissions
sed -i.bak 's/module\.exports = {/export {/' task${V}Converter.mjs
sed -i.bak "s/task${V}ConverterToJson/taskConverterToJson/g" task${V}Converter.mjs
sed -i.bak "s/toTask${V}Converter/toTaskConverter/g" task${V}Converter.mjs
sed -i.bak "s/Task${V}Converter/TaskConverter/g" task${V}Converter.mjs
sed -i.bak 's/"taskConverterToJson": //' task${V}Converter.mjs
sed -i.bak 's/"toTaskConverter": //' task${V}Converter.mjs

