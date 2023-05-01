#!/bin/bash

echo $PWD
#V="V02"
echo $V
quicktype --lang js --src-lang schema -o task${V}Converter.mjs task${V}Schema.json
sed -i 's/module\.exports = {/export {/' task${V}Converter.mjs
sed -i 's/"taskConverterToJson": //' task${V}Converter.mjs
sed -i 's/"toTaskConverter": //' task${V}Converter.mjs

