/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

const system = [
  {
    name: "systemshared",
    ceps: {
      shared: {
        type: "shared",
        isRegex: true,
        match: ".*instance.*",
        environments: ["rxjscopro"],
      }
    },
    parentName: "system",
    type: "TaskCEPShared",
  },
  {
    name: "systemlog",
    ceps: {
      systemlog: {
        type: "systemlog",
        isRegex: true,
        match: ".*instance.*",
        environments: ["rxjscopro"],
      }
    },
    parentName: "system",
    environments: ["rxjscopro"],
    config: {
      autoStartEnvironment: "rxjscopro",
      autoStartCoProcessor: true,
      autoStartpriority: "0",
    },
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
    name: "hub",
    parentName: "config",
    config: {
      label: "Hub",
    }
  },
  {
    initiator: true,
    name: "systemtasksconfigeditor",
    config: {
      label: "Tasks",
      local: {
        targetStore: "tasks",
        sharedVariable: "configTreeHubconsumerTasks",
      },
      debug: {
        debugTask: false,
      },
    },
    parentName: "hub",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerTasks: {},
    },
  },
  {
    initiator: true,
    name: "systemusersconfigeditor",
    config: {
      label: "Users",
      local: {
        targetStore: "users",
        sharedVariable: "configTreeHubconsumerUsers",
      },
    },
    parentName: "hub",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerUsers: {},
    },
  },
  {
    initiator: true,
    name: "systemgroupsconfigeditor",
    config: {
      label: "Groups",
      local: {
        targetStore: "groups",
        sharedVariable: "configTreeHubconsumerGroups",
      },
    },
    parentName: "hub",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerGroups: {},
    },
  },
  {
    initiator: true,
    name: "systemtasktypesconfigeditor",
    config: {
      label: "Task Types",
      local: {
        targetStore: "tasktypes",
        sharedVariable: "configTreeHubconsumerTasktypes",
      },
    },
    parentName: "hub",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerTasktypes: {},
    },
  },
  {
    name: "hubconsumer",
    parentName: "config",
    config: {
      label: "Hub Consumer",
    }
  },
  {
    initiator: true,
    name: "rxjs-cep-types-config-editor",
    environments: ["rxjs"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "ceptypes",
        sharedVariable: "configTreeHubconsumerCeptypes",
      },
    },
    parentName: "hubconsumer",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerCeptypes: {},
    },
  },
  {
    initiator: true,
    name: "rxjs-service-types-config-editor",
    environments: ["rxjs"],
    config: {
      label: "Service Types",
      local: {
        targetStore: "servicetypes",
        sharedVariable: "configTreeHubconsumerServicetypes",
      },
    },
    parentName: "hubconsumer",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerServicetypes: {},
    },
  },
  {
    initiator: true,
    name: "rxjs-operator-types-config-editor",
    environments: ["rxjs"],
    config: {
      label: "Operator Types",
      local: {
        targetStore: "operatortypes",
        sharedVariable: "configTreeHubconsumerOperatortypes",
      },
    },
    parentName: "hubconsumer",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerOperatortypes: {},
    },
  },
  {
    name: "hubcoprocessor",
    parentName: "config",
    config: {
      label: "Hub Coprocessor",
    }
  },
  {
    initiator: true,
    name: "hubcoprocessor-cep-types-config-editor",
    APPEND_environments: ["rxjscopro"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "ceptypes",
        sharedVariable: "configTreeHubcoprocessorCeptypes",
      },
    },
    parentName: "hubcoprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubcoprocessorCeptypes: {},
    },
  },
  {
    initiator: true,
    name: "hubcoprocessor-operator-types-config-editor",
    APPEND_environments: ["rxjscopro"],
    config: {
      label: "Operator Types",
      local: {
        targetStore: "oeratortypes",
        sharedVariable: "configTreeHubcoprocessorOperatortypes",
      },
    },
    parentName: "hubcoprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubcoprocessorOperatortypes: {},
    },
  },
  {
    initiator: true,
    name: "hubcoprocessor-service-types-config-editor",
    APPEND_environments: ["rxjscopro"],
    config: {
      label: "Service Types",
      local: {
        targetStore: "servicetypes",
        sharedVariable: "configTreeHubcoprocessorServicetypes",
      },
    },
    parentName: "hubcoprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubcoprocessorServicetypes: {},
    },
  },
  {
    name: "rxjs",
    parentName: "config",
    config: {
      label: "RxJS Consumer",
    }
  },
  {
    initiator: true,
    name: "rxjs-cep-types-config-editor",
    APPEND_environments: ["rxjscopro"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "ceptypes",
        sharedVariable: "configTreeRxjsCeptypes",
      },
    },
    parentName: "rxjs",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeRxjsCeptypes: {},
    },
  },
  {
    initiator: true,
    name: "rxjs-operator-types-config-editor",
    APPEND_environments: ["rxjscopro"],
    config: {
      label: "Operator Types",
      local: {
        targetStore: "oeratortypes",
        sharedVariable: "configTreeRxjsOperatortypes",
      },
    },
    parentName: "rxjs",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeRxjsOperatortypes: {},
    },
  },
  {
    initiator: true,
    name: "rxjs-service-types-config-editor",
    APPEND_environments: ["rxjscopro"],
    config: {
      label: "Service Types",
      local: {
        targetStore: "servicetypes",
        sharedVariable: "configTreeRxjsServicetypes",
      },
    },
    parentName: "rxjs",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeRxjsServicetypes: {},
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
    name: "nodeconfigs",
    environments: ["rxjs"],
    //environments: ["rxjs", "rxjscopro"],
    //environments: ["rxjs", "nodejs"],
    config: {
      background: true,
      debug: {
        debugTask: true,
      },
      autoStartEnvironment: "rxjs",
      //autoStartEnvironments: ["rxjs", "nodejs"],
    },
    parentName: "config",
    type: "TaskNodeConfigs",
    menu: false,
  },

];

export { system };