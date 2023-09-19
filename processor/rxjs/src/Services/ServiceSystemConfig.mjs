/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { utils } from "../utils.mjs";
import { tasksStore_async, tasktypesStore_async, usersStore_async, groupsStore_async } from "../storage.mjs";

let promiseResolvers = new Map();

// Not dealng with race conditions

// This is a hack, we would be better to use events or rxjs observables etc

export const registerForChange_async = async (targetConfig, id) => {
  return new Promise((resolve, reject) => {
    const existing = promiseResolvers.get(targetConfig) || [];
    if (id === undefined) {
      id = targetConfig;
    } else {
      id = targetConfig + "-" + id;
    }
    //console.log("createPromise", targetConfig, id);
    existing.push({ resolve, reject, id });
    promiseResolvers.set(targetConfig, existing);
    /*
    // Set timeout to reject the promise if it's not resolved within 60 seconds
    setTimeout(() => {
      reject(new Error("Timed out waiting for state change"));
    }, 60000);
    */
  });
};

const change_async = async (targetConfig, id) => {
  //console.log("change_async", targetConfig, id);
  if (promiseResolvers.has(targetConfig)) {
    const resolvers = promiseResolvers.get(targetConfig);
    //console.log("change_async has " + resolvers.length + " promises.");
    id = targetConfig + "-" + id;
    for (let i = resolvers.length - 1; i >= 0; i--) {
      if (resolvers[i].id === id) {
        //console.log("change_async resolve promise", targetConfig, id);
        resolvers[i].resolve(id);
        resolvers.splice(i, 1);  // Remove this element from the array
      }
    }
    id = targetConfig;
    for (let i = resolvers.length - 1; i >= 0; i--) {
      if (resolvers[i].id === id) {
        //console.log("change_async resolve promise", targetConfig, id);
        resolvers[i].resolve(id);
        resolvers.splice(i, 1);  // Remove this element from the array
      }
    }

  } else {
    //console.log("change_async has no promises");
  }
}

function getStore(targetConfig) {
  //console.log("getStore", targetConfig);
  switch (targetConfig) {
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

export const create_async = async (targetConfig, object, indicateChange = true) => {
  return update_async(targetConfig, object, indicateChange);
}

export const read_async = async (targetConfig, id) => {
  const store = getStore(targetConfig);
  return store.get(id);
}

export const update_async = async (targetConfig, object, indicateChange = true) => {
  const store = getStore(targetConfig);
  if (indicateChange) {change_async(targetConfig, object.id);}
  return store.set(object.id, object);
}

// Helper function to recursively update child objects
const deleteBranch_async = async (targetConfig, store, object) => {
  // Recursively update all child objects
  if (object.meta.childrenId && object.meta.childrenId.length > 0) {
    const promises = object.meta.childrenId.map(async (childId) => {
      let childObject = await read_async(targetConfig, childId);
      return deleteBranch_async(targetConfig, store, childObject);
    });
    await Promise.all(promises);
  }
  store.delete(object.id);
}

export const delete_async = async (targetConfig, id, indicateChange = true) => {
  const store = getStore(targetConfig);
  // We should delete the branch
  const object = await read_async(targetConfig, id)
  await deleteBranch_async(targetConfig, store, object);
  if (indicateChange) {change_async(targetConfig, id);}
  return store.delete(id);
}

export const update_value_async = async (targetConfig, id, key, value, indicateChange = true) => {
  const object = await read_async(targetConfig, id);
  if (!object) {
    console.log("update_value_async read_async did not find id", id);
  }
  const T = utils.createTaskValueGetter(object);
  console.log("update_value_async id, key, value", id, key, value);
  T(key, value);
  await update_async(targetConfig, T(), indicateChange);
  return T(key)
}

async function uniquifyId_async (targetConfig, objectName, parentObjectId) {
  let uniqueId = parentObjectId + "." + objectName;
  let uniqueIdFound = false;
  let index = 1;
  while (!uniqueIdFound) {
    const conflictingObject = await read_async(targetConfig, uniqueId);
    if (!conflictingObject) {
      uniqueIdFound = true;
    } else {
      uniqueId = `${parentObjectId}.${objectName}(${index})`;
      index++;
    }
  }
  return uniqueId;
}

// Helper function to recursively update child objects
const moveBranch_async = async (targetConfig, object, parentObject) => {
  // Build new id for object
  const oldId = object.id;
  object.id = await uniquifyId_async(targetConfig, object.name, parentObject.id);
  // Initialize meta.childrenId if it doesn't exist
  parentObject.meta.childrenId = parentObject.meta.childrenId || [];
  // Remove oldId from parent's children
  parentObject.meta.childrenId = parentObject.meta.childrenId.filter(id => id !== oldId);
  // Add new object id to parent's children
  parentObject.meta.childrenId.push(object.id);
  // Update parent information for this object
  object.meta.parentId = parentObject.id;
  object.parentName = parentObject.name;
  await Promise.all([
    update_async(targetConfig, parentObject, false),
    delete_async(targetConfig, oldId, false),
    update_async(targetConfig, object, false)
  ]);
  // Recursively update all child objects
  if (object.meta.childrenId && object.meta.childrenId.length > 0) {
    const promises = object.meta.childrenId.map(async (childId) => {
      let childObject = await read_async(targetConfig, childId);
      return moveBranch_async(targetConfig, childObject, object);
    });
    await Promise.all(promises);
  }  
  return object;
};

// Function to move a object to a different parent
export const move_async = async (targetConfig, actionId, destinationId) => {
  try {
    const object = await read_async(targetConfig, actionId);
    // Get current parent object
    const parentObject = await read_async(targetConfig, object.meta.parentId);
    if (!parentObject) throw new Error("Parent object not found " + object.meta.parentId);
    console.log("parentObject", parentObject);
    // Remove object from current parent's children
    parentObject.meta.childrenId = parentObject.meta.childrenId.filter(id => id !== object.id);
    // Update old parent object in the store
    // Get new parent object
    const newParentObject = await read_async(targetConfig, destinationId);
    if (!newParentObject) throw new Error("New parent object not found " + destinationId);
    await Promise.all([
      moveBranch_async(targetConfig, object, newParentObject),
      update_async(targetConfig, parentObject, false)
    ]);
    change_async(targetConfig, actionId);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the object:", error);
    throw error;
  }
};

const pasteBranch_async = async (targetConfig, object, parentObject) => {
  // Build new id for object
  object.id = await uniquifyId_async(targetConfig, object.name, parentObject.id);
  // Initialize meta.childrenId if it doesn't exist
  parentObject.meta.childrenId = parentObject.meta.childrenId || [];
  // Add new object id to parent's children
  parentObject.meta.childrenId.push(object.id);
  // Update new parent object in the store
  await update_async(targetConfig, parentObject, false);
  // Update parent information for this object
  object.meta.parentId = parentObject.id;
  object.parentName = parentObject.name;
  // Save updated object back to store
  await update_async(targetConfig, object, false);
  //console.log("Pasting object", object.id, "under parent", parentObject.id);
  // Recursively update all child objects
  if (object.meta.childrenId && object.meta.childrenId.length > 0) {
    const promises = object.meta.childrenId.map(async (childId) => {
      let childObject = await read_async(targetConfig, childId);
      await pasteBranch_async(targetConfig, childObject, object);
    });
    await Promise.all(promises);
  }  
};

export const paste_async = async (targetConfig, copiedObjectId, newObjectLabel, destinationId) => {
  try {
    //console.log("paste_async pasting", copiedObjectId, "as", newObjectLabel, "to", destinationId);
    const newObject = await read_async(targetConfig, copiedObjectId);
    const parentObject = await read_async(targetConfig, destinationId);
    newObject.name = newObjectLabel.toLowerCase();
    newObject.config = newObject.config || {};
    newObject.config.label = newObjectLabel;
    await pasteBranch_async(targetConfig, newObject, parentObject);
    change_async(targetConfig, newObject.id);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the object:", error);
    throw error;
  }
}

export const insert_async = async (targetConfig, actionId, newObjectLabel) => {
  try {
    const parentObject = await read_async(targetConfig, actionId);
    const newObject = utils.deepClone(parentObject);
    const newObjectName = newObjectLabel.toLowerCase();
    newObject.meta = newObject.meta || {};
    newObject.meta.childrenId = [];
    newObject.meta.parentId = parentObject.id;
    newObject.id = parentObject.id + "." + newObjectName;
    newObject.parentName = parentObject.name;
    newObject.name = newObjectName;
    newObject.config = newObject.config || {};
    newObject.config.label = newObjectLabel;
    parentObject.meta.childrenId = parentObject.meta.childrenId || [];
    parentObject.meta.childrenId.push(newObject.id);
    await update_async(targetConfig, parentObject, false);
    await create_async(targetConfig, newObject, false);
    change_async(targetConfig, actionId);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the object:", error);
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

export const buildTree_async = async (targetConfig) => {

  // Object to hold nodes by their id for quick access
  const nodesById = {
    root: {
      title: 'root',
      id: 'root',
      children: {}
    }
  };

  const store = getStore(targetConfig);
  
  // First pass: Create all the nodes
  for await (const [id, object] of store.iterator()) {
    
    // Check for duplicate IDs
    if (nodesById[id]) {
      if (id !== "root") {
        console.warn(`Duplicate ID found: ${id} Skipping.`);
      }
      continue;
    }
    
    // Create a new node for the current object
    const newNode = {
      title: object?.config?.label || id,
      id: id,
      children: {},
      parentId: object?.meta?.parentId,
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
      //console.warn(`Missing or invalid parent ID for node with id:${id} parentId:${parentId} Attaching to root.`);
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

export const ServiceSystemConfig = {
  buildTree_async,
  create_async, 
  insert_async, 
  move_async, 
  paste_async, 
  read_async, 
  update_async,
  update_value_async,
  delete_async, 
  getAllChildrenOfNode,
  registerForChange_async,
} 