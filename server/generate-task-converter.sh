#!/bin/bash

quicktype --lang js --src-lang schema -o src/shared/taskConverter.mjs src/shared/taskSchema.json
sed -i 's/module\.exports = {/export {/' src/shared/taskConverter.mjs
sed -i 's/"taskConverterToJson": //' src/shared/taskConverter.mjs
sed -i 's/"toTaskConverter": //' src/shared/taskConverter.mjs

