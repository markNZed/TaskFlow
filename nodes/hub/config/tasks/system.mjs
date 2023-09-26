/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

const system = [
  {
    name: "systemshared",
    config: {
      ceps: {
        shared: {
          type: "shared",
          isRegex: true,
          match: ".*instance.*",
          environments: ["rxjscopro"],
        }
      },
    },
    parentName: "system",
    type: "TaskCEPShared",
  },
  {
    name: "systemlog",
    config: {
      ceps: {
        systemlog: {
          type: "systemlog",
          isRegex: true,
          match: ".*instance.*",
          environments: ["rxjscopro"],
        }
      },
    },
    parentName: "system",
    type: "TaskCEP",
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
    type: "TaskNodeConfigEditor",
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
    type: "TaskNodeConfigEditor",
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
    type: "TaskNodeConfigEditor",
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
    type: "TaskNodeConfigEditor",
    shared: {
      tasktypesConfigTree: {},
    },
  },
  {
    name: "processorrxjs",
    parentName: "config",
    config: {
      label: "Processor RxJS",
    }
  },
  {
    initiator: true,
    name: "processor-rxjs-cep-types-config-editor",
    environments: ["rxjs"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "cep",
      },
    },
    parentName: "processorrxjs",
    type: "TaskNodeConfigEditor",
    shared: {
      rxjsCEPTypesConfigTree: {},
    },
  },
  {
    name: "processorrxjscopro",
    parentName: "config",
    config: {
      label: "Coprocessor RxJS",
    }
  },
  {
    initiator: true,
    name: "processor-rxjscopro-cep-types-config-editor",
    APPEND_environments: ["rxjscopro"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "cep",
      },
    },
    parentName: "processorrxjscopro",
    type: "TaskNodeConfigEditor",
    shared: {
      rxjscoproCEPTypesConfigTree: {},
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
    type: "TaskNodeConfigs",
    menu: false,
  },

];

export { system };