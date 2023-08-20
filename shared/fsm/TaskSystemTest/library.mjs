
/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

export const library = {
  queries: {
    /* Defined in the task config
    findTextarea: {
      query: 'textarea[name="prompt"]',
      field: "value",
      debug: false,
    },
    */
    findPrompt: {
      query: 'textarea[name="prompt"]',
      expect: "Hello World!",
      field: "value",
      debug: false,
    },
    findResponse: {
      query: '#chat-container > div:nth-last-child(2)',
      expect: "test text",
      field: "innerText",
    },
  },
  actions: {
    /* Defined in the task config
    enterPrompt: {
      type: "TaskChat",
      input: "promptText",
      value: "Hello World!",
    },
    */
    submitPrompt: {
      type: "TaskChat",
      input: "submitPrompt",
      value: true,
    },
  },
};