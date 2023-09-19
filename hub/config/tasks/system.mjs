/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { actionThenQuery } from '../../src/shared/fsm/xutils.mjs';

const system = [

  {
    name: "systemshared",
    config: {
      ceps: {
        ".*instance.*": {
          isRegex: true,
          functionName: "CEPShared",
        },
      },
    },
    parentName: "system",
    type: "TaskSystemShared",
  },
  {
    name: "systemlog",
    config: {
      ceps: {
        ".*instance.*": {
          isRegex: true,
          functionName: "CEPLog",
        },
      },
    },
    parentName: "system",
    type: "TaskSystemLog",
  }, 
  {
    initiator: true,
    name: "systemlogviewer",
    config: {
      label: "Log",
    },
    parentName: "system",
    type: "TaskSystemLogViewer",
  }, 
  {
    name: "config",
    parentName: "system",
  },
  {
    initiator: true,
    name: "systemtasksconfigeditor",
    config: {
      label: "Tasks",
      local: {
        targetStore: "tasks",
      },
      debug: {
        debugTask: false,
      },
    },
    parentName: "config",
    type: "TaskSystemConfigEditor",
    shared: {
      tasksConfigTree: {},
    },
  },
  {
    initiator: true,
    name: "systemusersconfigeditor",
    config: {
      label: "Users",
      local: {
        targetStore: "users",
      },
    },
    parentName: "config",
    type: "TaskSystemConfigEditor",
    shared: {
      usersConfigTree: {},
    },
  },
  {
    initiator: true,
    name: "systemgroupsconfigeditor",
    config: {
      label: "Groups",
      local: {
        targetStore: "groups",
      },
    },
    parentName: "config",
    type: "TaskSystemConfigEditor",
    shared: {
      groupsConfigTree: {},
    },
  },
  {
    initiator: true,
    name: "systemtasktypesconfigeditor",
    config: {
      label: "Task Types",
      local: {
        targetStore: "tasktypes",
      },
    },
    parentName: "config",
    type: "TaskSystemConfigEditor",
    shared: {
      tasktypesConfigTree: {},
    },
  },
  {
    name: "menu",
    parentName: "system",
    type: "TaskSystemMenu",
  },
  {
    initiator: true,
    name:"systemrestart",
    config: {
      label: "Restart", 
    },
    type: "TaskSystemRestart",
    parentName: "system",
  },
  {
    name: "systemconfigs",
    config: {
      background: true,
    },
    parentName: "config",
    type: "TaskSystemConfigs",
    menu: false,
  },

  {
    name: "testing",
    initiator: true, // Needed to see this, maybe because it had no children?
    config: {
      local: {
        targetTaskId: "root.user.conversation.zeroshot.start",
        timeout: 10000, // 10 seconds
      },
      fsm: {
        name: "chat",
        useMachine: true,
        devTools: true, 
        merge: {
          // The start state is defined here to demonstrate merging of states from task configs
          states: {
            ...actionThenQuery('start', [], ['findTextarea']),
          },
        },
        queries: { // Note that more queries are defined in the library
          findTextarea: {
            query: 'textarea[name="prompt"]',
            field: "value",
            debug: true,
          },
        },
        actions: { // Note that more actions are defined in the library
          enterPrompt: {
            type: "TaskChat",
            input: "promptText",
            value: "Hello World!",
            debug: true,
          },
        },
      },
      // This task is using CEP
      //   serviceStub is created via this tasks's coprocessor Task Function
      //   familyId is created via the TaskType configuration
    },
    parentName: "system",
    meta: {
      childrenId: ["root.user.conversation.zeroshot"],
    },
    type: "TaskSystemTest",
  },
];

export { system };