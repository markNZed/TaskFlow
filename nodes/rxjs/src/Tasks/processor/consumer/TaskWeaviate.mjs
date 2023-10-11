/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import weaviate from 'weaviate-ts-client';

// eslint-disable-next-line no-unused-vars
const TaskWeaviate_async = async function (wsSendTask, T, FSMHolder) {

  if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

  const client = weaviate.client({
    scheme: 'http',
    host: 'weaviate:8080',  // Replace with your endpoint
  });

  client
    .schema
    .getter()
    .do()
    .then(res => {
      console.log(res);
    })
    .catch(err => {
      console.error(err)
    });

  switch (T("state.current")) {
    default:
      console.log("WARNING unknown state : " + T("state.current"));
  }

  return T();
};

export { TaskWeaviate_async };
