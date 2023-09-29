/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { mongoConnection } from "#src/storage";
import mongoose from 'mongoose';
// Because any is defined as a Mixed type we need to use markModified
// If it has a schema then Mongoos can detect the change
const tasksSchema = new mongoose.Schema({
    _id: String,
    instanceId: String,
    current: mongoose.Schema.Types.Mixed,
    updatedAt: {
      date: {type: Date, index: true},
      timezone: String
    },
  });
  
  // Mongoose should create a collecton "tasks" in the database "taskflow"
const tasksModel = mongoConnection.model('tasks', tasksSchema);

export { tasksModel };