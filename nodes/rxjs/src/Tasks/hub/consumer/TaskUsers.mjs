/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { accessDB } from "#src/storage";
import bcrypt from 'bcrypt';
import { utils } from '#src/utils';

// eslint-disable-next-line no-unused-vars
const TaskUsers_async = async function (wsSendTask, T, FSMHolder) {

    if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

    const services = T("services");
    const configFunctions = services["systemConfig"].module;

    const hashPassword = async (password, saltRounds = 10) => {
      const salt = await bcrypt.genSalt(saltRounds);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    };

    switch (T("state.current")) {
        case "start": {
          break;
        }
        case "reactRequest": {
          utils.logTask(T(), "action", T("input.action"), utils.js(T("input")));
          switch (T("input.action")) {
            case "create": {
              const username = T("input.username");
              const password = T("input.password");
              // Check if the user already exists
              const row = await accessDB.get("SELECT COUNT(*) AS count FROM users WHERE username = ?", [username]);
              if (row.count > 0) {
                T("error", { message: "A user with this username already exists." });
              } else {
                // Insert the new user into the database
                const passwordHash = await hashPassword(password);
                await accessDB.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, passwordHash]);
              }
              const user = {
                id: username,
                name: username,
              }
              await configFunctions.create_async(services["systemConfig"], "users", user);
              // We would need to save to the config file but that will be expanded
              const page = T("input.page") || 1;
              const limit = T("input.limit") || 10;
              const offset = (page - 1) * limit;
              let users = await getAllUsers(limit, offset);
              T("response.users", users);
              let totalUserCount = await getTotalUserCount();
              T("response.totalUserCount", totalUserCount);
              T("commandDescription", "Created user " + username);
              break;
            }
            case "read": {
              const readUsername = T("input.username");
              const user = await accessDB.get("SELECT * FROM users WHERE username = ?", [readUsername]);
              if (user) {
                T("output.user", user);
              } else {
                T("error", { message: "User not found." });
              }
              T("commandDescription", "Read user ");
              break;
            }
            case "update": {
              const updateUsername = T("input.username");
              const newPassword = T("input.password");
              const newPasswordHash = await hashPassword(newPassword);
              await accessDB.run("UPDATE users SET password_hash = ? WHERE username = ?", [newPasswordHash, updateUsername]);
              T("commandDescription", "Updated user " + updateUsername);
              break;
            }
            case "delete": {
              console.log(`Users before DB`, T("response.users"));
              const deleteUsernames = T("input.usernames");
              const deletedUsers = [];
              for (const username of deleteUsernames) {
                try {
                  const result = await deleteUser(username);
                  if (result.changes > 0) {
                    deletedUsers.push(result.username); // Add username to deletedUsers if it was deleted
                  }
                } catch (err) {
                  console.error(`Error deleting user ${username}:`, err);
                }
              } 
              if (deletedUsers.length > 0) {
                T("response.deletedUsers", deletedUsers);
              } else {
                T("error", { message: "No users found for deletion." });
              }
              T("commandDescription", `Deleted users: ${deletedUsers.join(", ")}`);
              const page = T("input.page") || 1;
              const limit = T("input.limit") || 10;
              const offset = (page - 1) * limit;
              // So we can see the users that are deleted (the diff will not remove entries that disappear from an array)
              let users = await getAllUsers(limit, offset);
              console.log(`Users after DB`, users);
              T("response.users", users); // This is losing the nulls in the array, merging should keep the nulls at then end 
              let totalUserCount = await getTotalUserCount();
              T("response.totalUserCount", totalUserCount);
              break;
            }
            case "readAll": {
              const page = T("input.page") || 1;
              const limit = T("input.limit") || 10;
              const offset = (page - 1) * limit;
              // Get all TF users
              const userConfig = await configFunctions.buildTree_async(services["systemConfig"], "users"); // Get updated tree
              const TFusers = userConfig.children;
              console.log(`TFusers`, TFusers);
              utils.logTask(T(), "Select", limit, offset);
              let users = await getAllUsers(limit, offset);
              console.log(`Users after DB`, users);
              T("response.users", users);
              let totalUserCount = await getTotalUserCount();
              T("response.totalUserCount", totalUserCount);
              T("commandDescription", "Updated users ", users.length);
              utils.logTask(T(), "Users", users);
              break;
            }
          }
          T("state.current", "hubResponse");
          T("command", "update");
          utils.logTask(T(), "Action", T("commandDescription"));
          break;
        }
        case "hubResponse":
          // Wait for next action
          break;
        default:
          utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
          return null;
      }
    
    return null;

  async function getTotalUserCount() {
    let totalCount = 0;
    try {
      totalCount = await new Promise((resolve, reject) => {
        accessDB.get(`SELECT COUNT(*) AS count FROM users`, [], function (err, row) {
          if (err) {
            console.error(err.message);
            reject(err);
          } else {
            resolve(row.count);
          }
        });
      });
    } catch (err) {
      console.error(`Error getting total user count: ${err.message}`);
      // Depending on your error handling you might want to throw the error or handle it differently
      throw err;
    }
    return totalCount;
  }

  async function getAllUsers(limit, offset) {
    let users = [];
    try {
      users = await new Promise((resolve, reject) => {
        accessDB.all(`SELECT * FROM users ORDER BY username LIMIT ? OFFSET ?`, [limit, offset], function (err, rows) {
          if (err) {
            console.error(err.message);
            reject(err);
          } else {
            console.log(`Users returned`, rows);
            const strippedUsers = rows.map(user => {
              delete user.password_hash;
              return user;
            });
            resolve(strippedUsers);
          }
        });
      });
    } catch (err) {
      T("error", { message: err.message });
    }
    return users;
  }

  async function deleteUser(username) {
    try {
      let result = await new Promise((resolve, reject) => {
        accessDB.run("DELETE FROM users WHERE username = ?", [username], function (err) {
          if (err) {
            console.error(err.message);
            reject(err);
          } else {
            resolve({ changes: this.changes, username }); // Include the username in the result
          }
        });
      });
      return result;
    } catch (err) {
      console.error("Error deleting user:", err);
      throw err;
    }
  }
  

};

export { TaskUsers_async };
