/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { tasksStore_async } from "../../storage.mjs";

// We want CRUD operations for the config

export const buildTree_async = async () => {

  // Object to hold nodes by their id for quick access
  const nodesById = {
    root: {
      title: 'root',
      key: 'root',
      children: []
    }
  };
  
  // First pass: Create all the nodes
  for await (const { key: id, value: task } of tasksStore_async.iterate()) {
    
    // Check for duplicate IDs
    if (nodesById[id]) {
      console.warn(`Duplicate ID found: ${id} Skipping.`);
      continue;
    }
    
    // Create a new node for the current task
    const newNode = {
      title: task?.config?.label || id,
      key: id,
      children: [],
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
      nodesById.root.children.push(node);
      continue;
    } else {
      delete node.parentId;
    }
    
    // Attach node to its parent
    nodesById[parentId].children.push(node);
  }
  
  return [nodesById.root];
};

