/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

// eslint-disable-next-line no-unused-vars
const TaskConfigReload_async = async function (wsSendTask, T, FSMHolder) {

    if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

    switch (T("state.current")) {
        case "start": {
          T("state.current", "done");
          T("command", "usersConfigLoad");
          T("commandDescription", "Config reload");
          break;
        }
        case "done":
          break;
        default:
          console.log("WARNING unknown state : " + T("state.current"));
          return null;
      }
    
  
    return null;
  };
  
  export { TaskConfigReload_async };
  