/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

const system = [

  {
    // Just registering CEP function
    // Should probably move into a service
    name: "systemfamilytree",
    parentName: "system",
    type: "TaskCEPFamilyTree",
  },
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
    type: "TaskCEPShared",
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
    type: "TaskCEPSystemLog",
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

];

export { system };