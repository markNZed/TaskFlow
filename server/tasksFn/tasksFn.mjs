/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

var tasksFn = tasksFn || {};

import { TaskFromAgent_async } from './TaskFromAgent.mjs';
import { TaskShowResponse_async } from './TaskShowResponse.mjs';
import { TaskChoose_async } from './TaskChoose.mjs';
import { TaskChat_async } from './TaskChat.mjs';

tasksFn.TaskFromAgent_async = TaskFromAgent_async
tasksFn.TaskShowResponse_async = TaskShowResponse_async
tasksFn.TaskChoose_async = TaskChoose_async
tasksFn.TaskChat_async = TaskChat_async

export { tasksFn };