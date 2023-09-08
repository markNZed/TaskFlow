/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { tasksStore_async } from "../../storage.mjs";

// We want CRUD operations for the config

export const taskCreate_async = async (task) => {
  return tasksStore_async.set(task.id, task);
}

export const taskRead_async = async (id) => {
  return tasksStore_async.get(id);
}

export const taskDelete_async = async (id) => {
  return tasksStore_async.delete(id);
}

export const taskUpdate_async = async (task) => {
  return tasksStore_async.set(task.id, task);
}

// Helper function to recursively update child tasks
const updateMoveChildren_async = async (task, parentTask) => {
  // Build new id for task
  const oldId = task.id;
  const newId = parentTask.id + "." + task.name;
  const conflictingTask = await tasksStore_async.get(newId);
  if (conflictingTask) {
    throw new Error(`Task with id ${newId} already exists`);
  }
  task.id = newId;
  // Initialize meta.childrenId if it doesn't exist
  parentTask.meta.childrenId = parentTask.meta.childrenId || [];
  // Remove oldId from parent's children
  parentTask.meta.childrenId = parentTask.meta.childrenId.filter(id => id !== oldId);
  // Add new task id to parent's children
  parentTask.meta.childrenId.push(task.id);
  // Update new parent task in the store
  await tasksStore_async.set(parentTask.id, parentTask);
  // Update parent information for this task
  task.meta.parentId = parentTask.id;
  task.parentName = parentTask.name;
  // Delete the old entry
  await tasksStore_async.delete(oldId);
  // Save updated task back to store
  await tasksStore_async.set(task.id, task);
  // Recursively update all child tasks
  if (task.meta.childrenId && task.meta.childrenId.length > 0) {
    for (const childId of task.meta.childrenId) {
      let childTask = await tasksStore_async.get(childId);
      await updateMoveChildren_async(childTask, task);
    }
  }
  return task;
};

// Function to move a task to a different parent
export const taskMove_async = async (task, destinationId) => {
  try {
    // Get current parent task
    const parentTask = await tasksStore_async.get(task.meta.parentId);
    if (!parentTask) return;
    console.log("parentTask", parentTask);
    // Remove task from current parent's children
    parentTask.meta.childrenId = parentTask.meta.childrenId.filter(id => id !== task.id);
    // Update old parent task in the store
    // Get new parent task
    const newParentTask = await tasksStore_async.get(destinationId);
    if (!newParentTask) return;
    await updateMoveChildren_async(task, newParentTask);
    await tasksStore_async.set(parentTask.id, parentTask);
    return
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the task:", error);
    throw error;
  }
};

const updateCopyChildren_async = async (task, parentTask) => {
  // Build new id for task
  const newId = parentTask.id + "." + task.name;
  const conflictingTask = await tasksStore_async.get(newId);
  if (conflictingTask) {
    throw new Error(`Task with id ${newId} already exists`);
  }
  task.id = newId;
  // Initialize meta.childrenId if it doesn't exist
  parentTask.meta.childrenId = parentTask.meta.childrenId || [];
  // Add new task id to parent's children
  parentTask.meta.childrenId.push(task.id);
  // Update new parent task in the store
  await tasksStore_async.set(parentTask.id, parentTask);
  // Update parent information for this task
  task.meta.parentId = parentTask.id;
  task.parentName = parentTask.name;
  // Save updated task back to store
  await tasksStore_async.set(task.id, task);
  // Recursively update all child tasks
  if (task.meta.childrenId && task.meta.childrenId.length > 0) {
    for (const childId of task.meta.childrenId) {
      let childTask = await tasksStore_async.get(childId);
      await updateMoveChildren_async(childTask, task);
    }
  }
  return task;
};

export const taskPaste_async = async (copyTaskId, newTaskName, destinationId) => {
  try {
    const newTask = await taskRead_async(copyTaskId);
    const parentTask = await taskRead_async(destinationId);
    // Not working/tested
    newTask.name = newTaskName;
    updateCopyChildren_async(newTask, parentTask);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the task:", error);
    throw error;
  }
}

export const getAllChildrenOfNode = (nodeId, nodesById) => {
  const result = [];
  const traverseChildren = (currentNode) => {
    if (currentNode.children) {
      Object.keys(currentNode.children).forEach(key => {
        const child = currentNode.children[key];
        result.push(child);
        if (child === null) {
          console.log("Unexpected null object", key);
          return; // continue
        }
        traverseChildren(nodesById[child.key]);
      });
    }
  };
  const startNode = nodesById[nodeId];
  if (startNode) {
    traverseChildren(startNode);
  } else {
    console.error(`getAllChildrenOfNode could not find node ${nodeId}`);
  }
  return result;
};

// Set the nodeId to null so its branch is deleted
export const deleteBranch = (nodeId, configTree) => {
  const traverseChildren = (currentNode) => {
    if (currentNode.children) {
      Object.keys(currentNode.children).forEach(key => {
        const child = currentNode.children[key];
        if (child === null) {
          console.log("Unexpected null object", key);
          return; // continue
        }
        if (child.key === nodeId) {
          currentNode.children[key] = null;
          console.log(`deleteBranch deleting branch ${nodeId}`);
          return true;
        } else if (traverseChildren(child)) {
          return true;
        }
      });
      return false;
    }
  };
  traverseChildren(configTree);
  return configTree;
};

export const buildTree_async = async () => {

  console.log("buildTree_async");

  // Object to hold nodes by their id for quick access
  const nodesById = {
    root: {
      title: 'root',
      key: 'root',
      children: {}
    }
  };
  
  // First pass: Create all the nodes
  for await (const { key: id, value: task } of tasksStore_async.iterate()) {
    
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
      key: id,
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
      nodesById.root.children[node.key] = node;
      continue;
    } else {
      delete node.parentId;
    }
    
    // Attach node to its parent
    nodesById[parentId].children[node.key] = node;
  }
  
  return [nodesById, nodesById.root];
};

