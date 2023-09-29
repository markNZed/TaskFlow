/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// To be able to load the JSON without fetching it via a web request from the browser we use new import feature
// That requires using the assert keyword which is not yet supported by ESLint
// Also need to modify babble to support assertsion  @babel/plugin-syntax-import-assertions with changes to config-overrides.js
// Also changed ESlint parser to support asserttions at th eroot of the project:
//   npm i -D @babel/eslint-parser @babel/plugin-syntax-import-assertions
//   See .eslintrc.js sections for parser and parserOptions
import fsmJson from './default.json' assert { type: 'json' };

/* eslint-plugin-xstate-include */

// State name should represent what can happen (i.e. actions) in that state
// Actions should start with verbs
// Action that runs on entry should have the same name as the state
// There are default events for each state with the same name (and case) as the state that will cause a transition to the new state
// choose: for conditional actions 
// eslint-disable-next-line no-unused-vars
export function getFSM(initialTask) {
  return fsmJson;
}

