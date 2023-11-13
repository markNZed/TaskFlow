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
        isSingleton: true,
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
        isSingleton: true,
      }
    },
    parentName: "system",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      autoStartEnvironment: "rxjs-hub-coprocessor",
      autoStartCoprocessor: true,
      autoStartpriority: "0",
    },
    type: "TaskCEP",
  }, 

  {
    name: "taskflow",
    parentName: "system",
    type: "Taskflow",
    menu: false,
    config: {
      local: {
        menuId: "root.system.taskflow.menu",
      },
    },
  },
  {
    name: "menu",
    parentName: "taskflow",
    type: "TaskSystemMenu",
    permissions: [
      "*",
    ]
  },

  {
    name: "sysadmin",
    parentName: "system",
    config: {
      label: "Admin",
    },
  },

  {
    name: "admin-rag",
    config: {
      label: "RAG",
    },
    parentName: "sysadmin",
  },

  {
    name: "configs",
    parentName: "system",
  },
  {
    name: "hub",
    parentName: "configs",
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
        sharedVariable: "config-hub-consumer-tasks",
      },
      debug: {
        debugTask: false,
      },
    },
    parentName: "hub",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-consumer-tasks": {},
      },
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
        sharedVariable: "config-hub-consumer-users",
      },
    },
    parentName: "hub",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-consumer-users": {},
      },
    },
  },
  {
    initiator: true,
    name: "systemgroupsconfigeditor",
    config: {
      label: "Groups",
      local: {
        targetStore: "groups",
        sharedVariable: "config-hub-consumer-groups",
      },
    },
    parentName: "hub",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-consumer-groups": {},
      },
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
        sharedVariable: "config-hub-consumer-tasktypes",
      },
    },
    parentName: "hub",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-consumer-tasktypes": {},
      },
    },
  },
  {
    name: "hub-consumer",
    parentName: "configs",
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
        sharedVariable: "config-hub-consumer-ceptypes",
      },
    },
    parentName: "hub-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-consumer-ceptypes": {},
      }
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
        sharedVariable: "config-hub-consumer-servicetypes",
      },
    },
    parentName: "hub-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-consumer-servicetypes": {},
      },
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
        sharedVariable: "config-hub-consumer-peratortypes",
      },
    },
    parentName: "hub-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-consumer-peratortypes": {},
      },
    },
  },
  {
    name: "hub-coprocessor",
    parentName: "configs",
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
        sharedVariable: "config-hub-coprocessor-ceptypes",
      },
    },
    parentName: "hub-coprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-coprocessor-ceptypes": {},
      },
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
        sharedVariable: "config-hub-coprocessor-operatortypes",
      },
    },
    parentName: "hub-coprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-coprocessor-operatortypes": {},
      },
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
        sharedVariable: "config-hub-coprocessor-servicetypes",
      },
    },
    parentName: "hub-coprocessor",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-hub-coprocessor-servicetypes": {},
      },
    },
  },
  {
    name: "processor-consumer",
    parentName: "configs",
    config: {
      label: "RxJS Consumer",
    }
  },
  {
    initiator: true,
    name: "rxjs-ceptypes-config-editor",
    APPEND_environments: ["rxjs-processor-consumer"],
    config: {
      label: "CEP Types",
      local: {
        targetStore: "ceptypes",
        sharedVariable: "config-processor-consumer-ceptypes",
      },
    },
    parentName: "processor-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-processor-consumer-ceptypes": {},
      },
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
        sharedVariable: "config-processor-consumer-operatortypes",
      },
    },
    parentName: "processor-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-processor-consumer-operatortypes": {},
      },
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
        sharedVariable: "config-processor-consumer-servicetypes",
      },
    },
    parentName: "processor-consumer",
    type: "TaskNodeConfigEditor",
    shared: {
      system: {
        "config-processor-consumer-servicetypes": {},
      },
    },
  },

  {
    name: "rxjs-hub-consumer-nodeconfigs",
    environments: ["rxjs-hub-consumer"],
    config: {
      background: true,
      debug: {
        debugTask: false,
      },
      autoStartEnvironment: "rxjs-hub-consumer",
    },
    parentName: "configs",
    type: "TaskNodeConfigs",
    menu: false,    
    shared: {
      system: {
        "config-hub-consumer-tasks": {},
        "config-hub-consumer-users": {},
        "config-hub-consumer-groups": {},
        "config-hub-consumer-tasktypes": {},
        "config-hub-consumer-ceptypes": {},
        "config-hub-consumer-servicetypes": {},
        "config-hub-consumer-peratortypes": {},
      },
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
    parentName: "configs",
    type: "TaskNodeConfigs",
    menu: false,
    shared: {
      system: {
        "config-hub-coprocessor-ceptypes": {},
        "config-hub-coprocessor-servicetypes": {},
        "config-hub-coprocessor-operatortypes": {},
      },
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
    parentName: "configs",
    type: "TaskNodeConfigs",
    menu: false,
    shared: {
      system: {
        "config-processor-consumer-ceptypes": {},
        "config-processor-consumer-servicetypes": {},
        "config-processor-consumer-operatortypes": {},
      },
    },
  },

  {
    name: "systemconnections",
    ceps: {
      CEPConnect: {
        isRegex: true,
        match: ".*instance.*",
        environments: ["rxjs-hub-consumer"],
        isSingleton: true,
      }
    },
    parentName: "system",
    environments: ["rxjs-hub-consumer"],
    config: {
      autoStartEnvironment: "rxjs-hub-consumer",
      autoStartCoprocessor: true,
    },
    type: "TaskCEP",
  },

  {
    name: "systasks",
    parentName: "system",
    config: {
      label: "Tasks",
    },
  },
  {
    name: "config-reload",
    initiator: true,
    config: {
      label: "Reload",
    },
    parentName: "systasks",
    environments: ["rxjs-hub-consumer"],
    type: "TaskConfigReload",
    state: {
      current: "start",
    },
  },
  {
    initiator: true,
    name:"systemrestart",
    config: {
      label: "Restart", 
    },
    type: "TaskSystemRestart",
    parentName: "systasks",
  },
  {
    initiator: true,
    name: "systemlogviewer",
    config: {
      label: "Log",
    },
    parentName: "systasks",
    type: "TaskSystemLogViewer",
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
      label: "Edit",
      debug: {
        debugTask: true,
      },
    },
    parentName: "systasks",
    type: "TaskEdit",
  },
  
];

export { system };