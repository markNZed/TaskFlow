'use strict';
import { v4 as uuidv4 } from 'uuid'
import forEach from 'lodash';

const utils = {};

utils.fail = function(msg) {
  console.error(msg)
  exit
  process.exit(1)
}

utils.formatDateAndTime = function(date) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('fr-FR', options).format(date);
}

utils.load_data_async = async function(config_dir, name) {
    let result = {}
    try {
      result = (await import(config_dir + '/' + name + ".mjs"))[name];
    } catch (error) {
      console.log("No " + name + " at " + config_dir + '/' + name + ".mjs " + error);
    }
    return result
}

utils.findSubObjectWithKeyValue = function(obj, targetKey, targetValue) {
    if (typeof obj !== 'object' || obj === null) {
      return null;
    }
    if (obj[targetKey] === targetValue) {
      return obj;
    }
    for (const key in obj) {
      const result = utils.findSubObjectWithKeyValue(obj[key], targetKey, targetValue);
      if (result !== null) {
        return result;
      }
    }
    return null;
}
  
utils.djb2Hash = function(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // convert to unsigned 32-bit integer
}

utils.processMessages_async = async function(messages, messageStore_async, initialLastMessageId = null) {
    let lastMessageId = initialLastMessageId;
  
    for (const message of messages) {
      const id = uuidv4();
      const chatMessage = {
        role: message.role,
        id: id,
        parentMessageId: lastMessageId,
        text: message.content
      };
  
      if (message.role === "system") {
        error("Not expecting system message here");
      } else {
        await messageStore_async.set(id, chatMessage)
      }
      
      lastMessageId = id;
    }
    return lastMessageId;
}
  
utils.messagesText_async = async function(messageStore_async, LastMessageId) {
    let id = LastMessageId;
    let text = ''
    let message
    while (message = await messageStore_async.get(id)) {
      text = message.text + text // prepend
      id = message.parentMessageId
    }
    return text
}

utils.extract_client_info = function(task, filter_list) {
  if (!filter_list) {
    console.log("Warning: the task " + task.id + " is missing filter")
  }
  const taskCopy = { ...task }; // or const objCopy = Object.assign({}, obj);
  for (const key in taskCopy) {
    if (!filter_list.includes(key)) {
      delete taskCopy[key];
    }
  }
  return taskCopy
}

utils.authenticatedTask = function(task, userId, groups) {
  let authenticated = false
  if (task?.groups) {
    task.groups.forEach((group_name) => {
      if (!groups[group_name]) {
        console.log("Warning: could not find group " + group_name )
      } else {
        if (groups[group_name].users.includes(userId)) {
          authenticated = true
        }
      }
    });
  } else {
    authenticated = true
  }
  return authenticated
}

utils.capitalizeFirstLetter = function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Not that this has huge side-effects 
// Transform workflows array into flattened workflows hash
// We should introduce a concept of appending and prepending
// e.g. PREPEND_property would prepend the content to content form higher level instead of replacing content
// Functionality added but not tested
utils.flattenWorkflows = function(workflows) {
  // The default level is named 'root'
  var parent2id = {root : ''}
  var children = {}
  const regex_lowercase = /^[a-z]+$/;
  var workflowLookup = {}
  workflows.forEach(function(workflow) {
    if (!workflow?.name) {
      utils.fail('Error: Workflow missing name')
    }
    if (!workflow?.parent && workflow.name !== 'root') {
      utils.fail('Error: Workflow missing parent ' + workflow.name)
    }
    if (!regex_lowercase.test(workflow.name)) {
      utils.fail('Error: Workflow name should only include lowercase characters ' + workflow.name)
    }
    if (!parent2id[workflow.parent] && workflow.name !== 'root') {
      utils.fail('Error: Workflow parent ' + workflow.parent + ' does not exist in ' + workflow.name)
    } 
    var id
    if (workflow.name === 'root') {
      id = 'root'
    } else {
      id = parent2id[workflow.parent] + '.' + workflow.name
    }
    if (workflowLookup[id]) {
      utils.fail('Error: Duplicate workflow ' + id)
    }
    // Add id to each task
    if (workflow?.tasks) {
      for (const key in workflow.tasks) {
        if (workflow.tasks.hasOwnProperty(key)) {
          workflow.tasks[key]['name'] = key
          workflow.tasks[key]['id'] = id + '.' + key
          // Avoid the task inheriting the label from the Workflow
          if (!workflow.tasks[key]['label']) {
            workflow.tasks[key]['label'] = ''
          }
          // Convert relative task references to absolute
          if (workflow.tasks[key]['next'] && !workflow.tasks[key]['next'].includes('.')) {
            workflow.tasks[key]['next'] = id + '.' + workflow.tasks[key]['next']
          }
          if (workflow.tasks[key]['next_template']) {
            let nt = workflow.tasks[key]['next_template']
            for (const key in nt) {
              if (nt.hasOwnProperty(key)) {
                if (!nt[key].includes('.')) {
                  nt[key] = id + '.' + nt[key]
                }
              }
            }
          }
        }
      }
    }
    if (!workflow?.label) {
      workflow['label'] = utils.capitalizeFirstLetter(workflow.name)
    }
    workflow['id'] = id
    workflow['parentId'] = parent2id[workflow.parent]  
    // Copy all the keys from the parent that are not in the current workflow
    // Could create functions here for PREPEND and APPEND
    const parentWorkflow = workflowLookup[workflow['parentId']]
    for (const key in parentWorkflow) {
      if (parentWorkflow.hasOwnProperty(key)) {
        if (!workflow.hasOwnProperty(key)) {
          workflow[key] = parentWorkflow[key]
          //console.log("Added parent " + key + " to workflow " + id )
        }
        if (workflow.hasOwnProperty('PREPEND_' + key)) {
          if (Array.isArray(workflow['PREPEND_' + key])) {
            workflow[key] = workflow['PREPEND_' + key].concat(parentWorkflow[key]);
          } else {
            workflow[key] = workflow['PREPEND_' + key] + parentWorkflow[key]
          }
        } else if (workflow.hasOwnProperty('APPEND_' + key)) {
          if (Array.isArray(workflow['APPEND_' + key])) {
            workflow[key] = parentWorkflow[key].concat(workflow['APPEND_' + key]);
          } else {
            workflow[key] =  parentWorkflow[key] + workflow['APPEND_' + key]
          }
        }
      }
    }
    // Copy all the keys from the workflow that are not in the current tasks
    if (workflow?.tasks) {
      for (const taskkey in workflow.tasks) {
        if (workflow.tasks.hasOwnProperty(taskkey)) {
          for (const workflowkey in workflow) {
            if (workflow.hasOwnProperty(workflowkey)) {
              if (!workflow.tasks[taskkey].hasOwnProperty(workflowkey)) {
                if (workflowkey !== 'tasks') {
                  workflow.tasks[taskkey][workflowkey] = workflow[workflowkey]
                  //console.log("Added workflow " + workflowkey + " to task " + workflow.tasks[taskkey]['id'] )
                }
                if (workflow.tasks[taskkey].hasOwnProperty('PREPEND_' + workflowkey)) {
                  if (Array.isArray(workflow.tasks[taskkey]['PREPEND_' + workflowkey])) {
                    workflow.tasks[taskkey] = workflow.tasks['PREPEND_' + workflowkey].concat(workflow[workflowkey]);
                  } else {
                    workflow.tasks[taskkey] = workflow.tasks['PREPEND_' + workflowkey] + workflow[workflowkey]
                  }
                } else if (workflow.tasks[taskkey].hasOwnProperty('APPEND_' + workflowkey)) {
                  if (Array.isArray(workflow.tasks[taskkey]['APPEND_' + workflowkey])) {
                    workflow.tasks[taskkey] = workflow[workflowkey].concat(workflow.tasks['APPEND_' + workflowkey]);
                  } else {
                    workflow.tasks[taskkey] =  workflow[workflowkey] + workflow.tasks['APPEND_' + workflowkey]
                  }
                }
              }
            }
          }
        }
      }
    }
    workflowLookup[id] = workflow
    parent2id[workflow.name] = id
    // Build children data
    if (children[workflow['parentId']]) {
      children[workflow['parentId']].push(workflow.id);
    } else {
      children[workflow['parentId']] = [workflow.id]
    }
  });

  //console.log(JSON.stringify(workflowLookup, null, 2))

  // For the menu building
  workflows.forEach(function(workflow) {
    if (children[workflow.id]) {
      workflowLookup[workflow.id]['children'] = children[workflow.id]
    }
  });

  // Replace array of workflows with hash
  // Array just made it easier for the user to specify parents in the config file
  return workflowLookup

}
  
export { utils };