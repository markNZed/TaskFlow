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
    name: "systemlogger",
    ceps: {
      systemlogger: {
        type: "systemlogger",
        isRegex: true,
        match: ".*instance.*",
        environments: ["rxjs-hub-coprocessor"],
        isSingleton: true,
      }
    },
    parentName: "system",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      local: {
        autoStartEnvironment: "rxjs-hub-coprocessor",
        autoStartCoprocessor: true,
        autoStartpriority: "0",
      }
    },
    type: "TaskCEP",
  },
  {
    name: "system-cron",
    ceps: {
      CEPCron: {
        type: "CEPCron",
        isRegex: true,
        match: ".*instance.*",
        environments: ["rxjs-hub-coprocessor"],
        isSingleton: true,
      }
    },
    parentName: "system",
    environments: ["rxjs-hub-coprocessor"],
    config: {
      local: {
        autoStartEnvironment: "rxjs-hub-coprocessor",
        autoStartCoprocessor: true,
        autoStartpriority: "1",
      }
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
        autoStartEnvironment: "react",
      },
    },
  },
  {
    name: "menu",
    parentName: "taskflow",
    type: "TaskSystemMenu",
    APPEND_permissions: [
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
      local: {
        autoStartEnvironment: "rxjs-hub-consumer",
      },
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
      local: {
        autoStartEnvironment: "rxjs-hub-coprocessor",
      },
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
      local: {
        autoStartEnvironment: "rxjs-processor-consumer",
      },
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
      local: {
        autoStartEnvironment: "rxjs-hub-consumer",
        autoStartCoprocessor: true,
      },
    },
    type: "TaskCEP",
  },

  {
    name: "tasks",
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
    parentName: "tasks",
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
    parentName: "tasks",
  },
  {
    initiator: true,
    name: "log",
    config: {
      label: "Log",
      local: {
        createColumns: "system",
        autoQuery: true,
      },
    },
    parentName: "tasks",
    type: "TaskLog",
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
        //debugTask: true,
      },
    },
    parentName: "tasks",
    type: "TaskEdit",
  },

  {
    name: "system-cron-demo",
    initiator: true,
    config: {
      label: "Cron",
      local: {
        instruction: "This started a cron task",
      },
    },
    parentName: "tasks",
    type: "TaskShowInstruction",
  },
  {
    name: "system-cron",
    parentName: "system-cron-demo",
    type: "TaskCEP",
    config: {
      debug: {
        //debugTask: true,
      },
    },
    // Every minute sync this task and set request.increment to true
    // But this is only running on rxjs-hub-coprocessor that is dealing with CEP
    // Maybe this should not be TaskCEP -could be TaskInstruction ?
    cron: {
      "testing": {
        cronTime: '0 */1 * * * *',
        start: true,
        syncTask: {
          request: {
            increment: true
          }
        }
      }
    },
    environments: ["rxjs-hub-coprocessor"],
  },
  
];

export { system };