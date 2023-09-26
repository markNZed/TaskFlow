/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

"use strict";

import { CEPsMap } from "./storage.mjs";

const CEPFunctions = {

  register: function(functionName, func) {
    console.log("CEPFunctions register", functionName);
    if (typeof func === "function") {
      CEPFunctions[functionName] = func;
    }
  },

  get: function(funcName) {
    if (typeof CEPFunctions[funcName] === 'function') {
        return CEPFunctions[funcName];
    } else {
        throw new Error('Invalid function name ' + funcName);
    } 
  },

};

export { CEPFunctions };
