/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../../utils.mjs";
import { tasksStore_async, tasktypesStore_async, usersStore_async, groupsStore_async } from "../../storage.mjs";

// We want CRUD operations for the config

function getStore(targetStore) {
  //console.log("getStore", targetStore);
  switch (targetStore) {
    case "tasks":
      return tasksStore_async;
    case "tasktypes":
      return tasktypesStore_async;
    case "users":
      return usersStore_async;
    case "groups":
      return groupsStore_async;
    default:
      return null;
  }
}

export const create_async = async (targetStore, task) => {
  return update_async(targetStore, task);
}

export const read_async = async (targetStore, id) => {
  const store = getStore(targetStore);
  return store.get(id);
}

export const update_async = async (targetStore, task) => {
  const store = getStore(targetStore);
  return store.set(task.id, task);
}

export const delete_async = async (targetStore, id) => {
  const store = getStore(targetStore);
  return store.delete(id);
}

async function uniquifyId_async (targetStore, taskName, parentTaskId) {
  let uniqueId = parentTaskId + "." + taskName;
  let uniqueIdFound = false;
  let index = 1;
  while (!uniqueIdFound) {
    const conflictingTask = await read_async(targetStore, uniqueId);
    if (!conflictingTask) {
      uniqueIdFound = true;
    } else {
      uniqueId = `${parentTaskId}.${taskName}(${index})`;
      index++;
    }
  }
}

// Helper function to recursively update child tasks
const moveBranch_async = async (targetStore,task, parentTask) => {
  // Build new id for task
  const oldId = task.id;
  task.id = uniquifyId_async(targetStore, task.name, parentTask.id);
  // Initialize meta.childrenId if it doesn't exist
  parentTask.meta.childrenId = parentTask.meta.childrenId || [];
  // Remove oldId from parent's children
  parentTask.meta.childrenId = parentTask.meta.childrenId.filter(id => id !== oldId);
  // Add new task id to parent's children
  parentTask.meta.childrenId.push(task.id);
  // Update parent information for this task
  task.meta.parentId = parentTask.id;
  task.parentName = parentTask.name;
  await Promise.all([
    update_async(targetStore, parentTask),
    delete_async(targetStore, oldId),
    update_async(targetStore, task)
  ]);
  // Recursively update all child tasks
  if (task.meta.childrenId && task.meta.childrenId.length > 0) {
    const promises = task.meta.childrenId.map(async (childId) => {
      let childTask = await read_async(targetStore, childId);
      return moveBranch_async(targetStore, childTask, task);
    });
  
    await Promise.all(promises);
  }  
  return task;
};

// Function to move a task to a different parent
export const move_async = async (targetStore, actionId, destinationId) => {
  try {
    const task = await read_async(targetStore, actionId);
    // Get current parent task
    const parentTask = await read_async(targetStore, task.meta.parentId);
    if (!parentTask) throw new Error("Parent task not found " + task.meta.parentId);
    console.log("parentTask", parentTask);
    // Remove task from current parent's children
    parentTask.meta.childrenId = parentTask.meta.childrenId.filter(id => id !== task.id);
    // Update old parent task in the store
    // Get new parent task
    const newParentTask = await read_async(targetStore, destinationId);
    if (!newParentTask) throw new Error("New parent task not found " + destinationId);
    return Promise.all([
      moveBranch_async(targetStore, task, newParentTask),
      update_async(targetStore, parentTask)
    ]);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the task:", error);
    throw error;
  }
};

const pasteBranch_async = async (targetStore, task, parentTask) => {
  // Build new id for task
  task.id = uniquifyId_async(targetStore, task.name, parentTask.id);
  // Initialize meta.childrenId if it doesn't exist
  parentTask.meta.childrenId = parentTask.meta.childrenId || [];
  // Add new task id to parent's children
  parentTask.meta.childrenId.push(task.id);
  // Update new parent task in the store
  await update_async(targetStore, parentTask);
  // Update parent information for this task
  task.meta.parentId = parentTask.id;
  task.parentName = parentTask.name;
  // Save updated task back to store
  await update_async(targetStore, task);
  //console.log("Pasting task", task.id, "under parent", parentTask.id);
  // Recursively update all child tasks
  if (task.meta.childrenId && task.meta.childrenId.length > 0) {
    const promises = task.meta.childrenId.map(async (childId) => {
      let childTask = await read_async(targetStore, childId);
      await pasteBranch_async(targetStore, childTask, task);
    });
    await Promise.all(promises);
  }  
};

export const paste_async = async (targetStore, copiedTaskId, newTaskLabel, destinationId) => {
  try {
    //console.log("paste_async pasting", copiedTaskId, "as", newTaskLabel, "to", destinationId);
    const newTask = await read_async(targetStore, copiedTaskId);
    const parentTask = await read_async(targetStore, destinationId);
    newTask.name = newTaskLabel.toLowerCase();
    newTask.config = newTask.config || {};
    newTask.config.label = newTaskLabel;
    await pasteBranch_async(targetStore, newTask, parentTask);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the task:", error);
    throw error;
  }
}

export const insert_async = async (targetStore, actionId, newTaskLabel) => {
  try {
    const parentTask = await read_async(targetStore, actionId);
    const newTask = utils.deepClone(parentTask);
    const newTaskName = newTaskLabel.toLowerCase();
    newTask.meta = newTask.meta || {};
    newTask.meta.childrenId = [];
    newTask.meta.parentId = parentTask.id;
    newTask.id = parentTask.id + "." + newTaskName;
    newTask.parentName = parentTask.name;
    newTask.name = newTaskName;
    newTask.config = newTask.config || {};
    newTask.config.label = newTaskLabel;
    parentTask.meta.childrenId = parentTask.meta.childrenId || [];
    parentTask.meta.childrenId.push(newTask.id);
    await update_async(targetStore, parentTask);
    await create_async(targetStore, newTask);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the task:", error);
    throw error;
  }
}

export const getAllChildrenOfNode = (nodeId, root) => {
  const result = [];
  const traverseChildren = (currentNode) => {
    if (currentNode.children) {
      Object.keys(currentNode.children).forEach(id => {
        const child = currentNode.children[id];
        result.push(child);
        if (child === null) {
          console.log("Unexpected null object", id);
          return; // continue
        }
        traverseChildren(child);
      });
    }
  };

  // Function to find the start node by nodeId
  const findStartNode = (node, nodeId) => {
    if (node.id === nodeId) {
      return node;
    }
    let result = null;
    if (node.children) {
      for (const id in node.children) {
        result = findStartNode(node.children[id], nodeId);
        if (result !== null) {
          break;
        }
      }
    }
    return result;
  };

  const startNode = findStartNode(root, nodeId);
  if (startNode) {
    traverseChildren(startNode);
  } else {
    console.error(`getAllChildrenOfNode could not find node ${nodeId}`);
  }
  return result;
};

// Function to sort the children of a node alphabetically by id
const sortChildren = (node) => {
  if (node.children) {
    // Convert children object to array
    const childrenArray = Object.values(node.children);
    // Sort array
    childrenArray.sort((a, b) => a.id.localeCompare(b.id));
    // Convert array back to object
    node.children = {};
    for (const child of childrenArray) {
      node.children[child.id] = child;
      // Recursively sort this child's children
      sortChildren(child);
    }
  }
};

export const buildTree_async = async (targetStore) => {

  // Object to hold nodes by their id for quick access
  const nodesById = {
    root: {
      title: 'root',
      id: 'root',
      children: {}
    }
  };

  const store = getStore(targetStore);
  
  // First pass: Create all the nodes
  for await (const [id, task] of store.iterator()) {
    
    // Check for duplicate IDs
    if (nodesById[id]) {
      if (id !== "root") {
        console.warn(`Duplicate ID found: ${id} Skipping.`);
      }
      continue;
    }
    
    // Create a new node for the current task
    const newNode = {
      title: task?.config?.label || id,
      id: id,
      children: {},
      parentId: task?.meta?.parentId,
    };

    // Add the node to the nodesById object
    nodesById[id] = newNode;
  }
  
  // Second pass: Establish parent-child relationships
  for (const id in nodesById) {
    if (id === 'root') continue; // Skip the root node
    
    const node = nodesById[id];
    const { parentId } = node; // Assume this information is available in the node

    if (!parentId || !nodesById[parentId]) {
      console.warn(`Missing or invalid parent ID for node with id:${id} parentId:${parentId} Attaching to root.`);
      nodesById.root.children[node.id] = node;
      continue;
    } else {
      delete node.parentId;
    }
    
    // Attach node to its parent
    nodesById[parentId].children[node.id] = node;
  }

  const result = nodesById.root;

  sortChildren(result);
  
  return result;
};

