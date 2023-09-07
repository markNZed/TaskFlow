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

