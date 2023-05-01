#!/bin/bash

V="V01"
echo $V
quicktype --lang js --src-lang schema -o task${V}Converter.mjs task${V}Schema.json
sed -i 's/module\.exports = {/export {/' task${V}Converter.mjs
sed -i "s/task${V}ConverterToJson/taskConverterToJson/g" task${V}Converter.mjs
sed -i "s/toTask${V}Converter/toTaskConverter/g" task${V}Converter.mjs
sed -i 's/"taskConverterToJson": //' task${V}Converter.mjs
sed -i 's/"toTaskConverter": //' task${V}Converter.mjs

