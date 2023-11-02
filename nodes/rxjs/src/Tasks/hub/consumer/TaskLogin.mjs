/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import jwt from 'jsonwebtoken';

// eslint-disable-next-line no-unused-vars
const TaskLogin_async = async function (wsSendTask, T, FSMHolder) {

    if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

    switch (T("state.current")) {
        case "start": {
          break;
        }
        case "sent": {
          const username = T("input.username");
          const password = T("input.password");
          console.log("Login:", username, password);
          // Check username and password
          let authorized = true;
          if (authorized) {
            // NODE will hold JWT secret
            const JWT_SECRET = process.env.JWT_SECRET || "nojwtsecret";
            // Generate JWT Token
            const token = jwt.sign({ id: T("user.id") }, JWT_SECRET, { expiresIn: '7d' });
            T("output.jwt", token);
            T("state.current", "jwt");
            T("command", "update");
            T("commandDescription", "Return JWT after login");
          }
          break;
        }
        case "jwt":
          break
        default:
          console.log("WARNING unknown state : " + T("state.current"));
          return null;
      }
    
  
    return null;
  };
  
  export { TaskLogin_async };
  