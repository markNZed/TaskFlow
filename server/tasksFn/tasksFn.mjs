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