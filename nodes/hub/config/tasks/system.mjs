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
        environments: ["rxjs-hub-coprocessor"],
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
        environments: ["rxjs-hub-coprocessor"],
      }
    },
    parentName: "system",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      autoStartEnvironment: "rxjs-hub-coprocessor",
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
    APPEND_environments: ["rxjs-hub-consumer"],
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
    APPEND_environments: ["rxjs-hub-consumer"],
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
    APPEND_environments: ["rxjs-hub-consumer"],
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
    name: "hub-consumer",
    parentName: "config",
    config: {
      label: "Hub Consumer",
    }
  },
  {
    initiator: true,
    name: "rxjs-cep-types-config-editor",
    APPEND_environments: ["rxjs-hub-consumer"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "ceptypes",
        sharedVariable: "configTreeHubconsumerCeptypes",
      },
    },
    parentName: "hub-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerCeptypes: {},
    },
  },
  {
    initiator: true,
    name: "rxjs-service-types-config-editor",
    APPEND_environments: ["rxjs-hub-consumer"],
    config: {
      label: "Service Types",
      local: {
        targetStore: "servicetypes",
        sharedVariable: "configTreeHubconsumerServicetypes",
      },
    },
    parentName: "hub-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerServicetypes: {},
    },
  },
  {
    initiator: true,
    name: "rxjs-operator-types-config-editor",
    APPEND_environments: ["rxjs-hub-consumer"],
    config: {
      label: "Operator Types",
      local: {
        targetStore: "operatortypes",
        sharedVariable: "configTreeHubconsumerOperatortypes",
      },
    },
    parentName: "hub-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubconsumerOperatortypes: {},
    },
  },
  {
    name: "hub-coprocessor",
    parentName: "config",
    config: {
      label: "Hub Coprocessor",
    }
  },
  {
    initiator: true,
    name: "hub-coprocessor-cep-types-config-editor",
    APPEND_environments: ["rxjs-hub-coprocessor"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "ceptypes",
        sharedVariable: "configTreeHubcoprocessorCeptypes",
      },
    },
    parentName: "hub-coprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubcoprocessorCeptypes: {},
    },
  },
  {
    initiator: true,
    name: "hub-coprocessor-operator-types-config-editor",
    APPEND_environments: ["rxjs-hub-coprocessor"],
    config: {
      label: "Operator Types",
      local: {
        targetStore: "operatortypes",
        sharedVariable: "configTreeHubcoprocessorOperatortypes",
      },
    },
    parentName: "hub-coprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubcoprocessorOperatortypes: {},
    },
  },
  {
    initiator: true,
    name: "hub-coprocessor-service-types-config-editor",
    APPEND_environments: ["rxjs-hub-coprocessor"],
    config: {
      label: "Service Types",
      local: {
        targetStore: "servicetypes",
        sharedVariable: "configTreeHubcoprocessorServicetypes",
      },
    },
    parentName: "hub-coprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeHubcoprocessorServicetypes: {},
    },
  },
  {
    name: "rxjs-hub-consumer",
    parentName: "config",
    config: {
      label: "RxJS Consumer",
    }
  },
  {
    initiator: true,
    name: "rxjs-cep-types-config-editor",
    APPEND_environments: ["rxjs-processor-consumer"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "ceptypes",
        sharedVariable: "configTreeRxjsCeptypes",
      },
    },
    parentName: "rxjs-hub-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeRxjsCeptypes: {},
    },
  },
  {
    initiator: true,
    name: "rxjs-operator-types-config-editor",
    APPEND_environments: ["rxjs-processor-consumer"],
    config: {
      label: "Operator Types",
      local: {
        targetStore: "operatortypes",
        sharedVariable: "configTreeRxjsOperatortypes",
      },
    },
    parentName: "rxjs-hub-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      configTreeRxjsOperatortypes: {},
    },
  },
  {
    initiator: true,
    name: "rxjs-service-types-config-editor",
    APPEND_environments: ["rxjs-processor-consumer"],
    config: {
      label: "Service Types",
      local: {
        targetStore: "servicetypes",
        sharedVariable: "configTreeRxjsServicetypes",
      },
    },
    parentName: "rxjs-hub-consumer",
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
    name: "rxjs-nodeconfigs",
    environments: ["rxjs-hub-consumer"],
    config: {
      background: true,
      debug: {
        debugTask: false,
      },
      autoStartEnvironment: "rxjs-hub-consumer",
    },
    parentName: "config",
    type: "TaskNodeConfigs",
    menu: false,    
    shared: {
      configTreeHubconsumerTasks: {},
      configTreeHubconsumerUsers: {},
      configTreeHubconsumerGroups: {},
      configTreeHubconsumerTasktypes: {},
      configTreeHubconsumerCeptypes: {},
      configtreeHubconsumerServicetypes: {},
      configtreeHubconsumerOperatortypes: {},
    },
  },
  {
    name: "rxjs-hub-coprocessor-nodeconfigs",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      background: true,
      debug: {
        debugTask: false,
      },
      autoStartEnvironment: "rxjs-hub-coprocessor",
    },
    parentName: "config",
    type: "TaskNodeConfigs",
    menu: false,
    shared: {
      configTreeHubcoprocessorCeptypes: {},
      configtreeHubcoprocessorServicetypes: {},
      configtreeHubcoprocessorOperatortypes: {},
    },
  },
  {
    name: "rxjs-processor-consumer-nodeconfigs",
    environments: ["rxjs-processor-consumer"],
    config: {
      background: true,
      debug: {
        debugTask: false,
      },
      autoStartEnvironment: "rxjs-processor-consumer",
    },
    parentName: "config",
    type: "TaskNodeConfigs",
    menu: false,
    shared: {
      configTreeRxjsCeptypes: {},
      configtreeRxjsServicetypes: {},
      configtreeRxjsOperatortypes: {},
    },
  },

  {
    initiator: true,
    name: "instanceedit",
    ceps: {
      monitorInstance: {
        type: "monitorInstance",
        environments: ["rxjs-hub-coprocessor"],
        match: "tbd", // To be defined
      }
    },
    config: {
      label: "Edit Task",
      debug: {
        debugTask: true,
      },
    },
    parentName: "system",
    type: "TaskEdit",
  }, 
  
];

export { system };