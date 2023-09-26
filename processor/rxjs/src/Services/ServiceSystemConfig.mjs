/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { tasksStore_async, tasktypesStore_async, usersStore_async, groupsStore_async, cepTypes_async, serviceTypes_async, operatorTypes_async } from "../../src/storage.mjs";

import { utils } from "#src/utils";

let promiseResolvers = new Map();

// Not dealng with race conditions

// This is a hack, we would be better to use events or rxjs observables etc

export const registerForChange_async = async (storeName, id) => {
  return new Promise((resolve, reject) => {
    const existing = promiseResolvers.get(storeName) || [];
    if (id === undefined) {
      id = storeName;
    } else {
      id = storeName + "-" + id;
    }
    //console.log("createPromise", storeName, id);
    existing.push({ resolve, reject, id });
    promiseResolvers.set(storeName, existing);
    /*
    // Set timeout to reject the promise if it's not resolved within 60 seconds
    setTimeout(() => {
      reject(new Error("Timed out waiting for state change"));
    }, 60000);
    */
  });
};

const change_async = async (storeName, id) => {
  //console.log("change_async", storeName, id);
  if (promiseResolvers.has(storeName)) {
    const resolvers = promiseResolvers.get(storeName);
    //console.log("change_async has " + resolvers.length + " promises.");
    id = storeName + "-" + id;
    for (let i = resolvers.length - 1; i >= 0; i--) {
      if (resolvers[i].id === id) {
        //console.log("change_async resolve promise", storeName, id);
        resolvers[i].resolve(id);
        resolvers.splice(i, 1);  // Remove this element from the array
      }
    }
    id = storeName;
    for (let i = resolvers.length - 1; i >= 0; i--) {
      if (resolvers[i].id === id) {
        //console.log("change_async resolve promise", storeName, id);
        resolvers[i].resolve(id);
        resolvers.splice(i, 1);  // Remove this element from the array
      }
    }

  } else {
    //console.log("change_async has no promises");
  }
}

function getStore(config, storeName) {
  // check if the configuration is available
  if (config.stores && config.stores.includes(storeName)) {
    switch (storeName) {
      case "tasks":
        return tasksStore_async;
      case "tasktypes":
        return tasktypesStore_async;
      case "users":
        return usersStore_async;
      case "groups":
        return groupsStore_async;
      case "ceptypes":
        return cepTypes_async;
      case "servicetypes":
        return serviceTypes_async;
      case "operatortypes":
        return operatorTypes_async;
      default:
        throw new Error("Store " + storeName + " not available in service configuration");
    }
  } else {
    console.error("Store " + storeName + " not available in service configuration",config);
    throw new Error("Store " + storeName + " not available in service configuration");
  }
}

export const create_async = async (config, storeName, object, indicateChange = true) => {
  return update_async(config, storeName, object, indicateChange);
}

export const read_async = async (config, storeName, id) => {
  const store = getStore(config, storeName);
  return store.get(id);
}

export const update_async = async (config, storeName, object, indicateChange = true) => {
  const store = getStore(config, storeName);
  if (indicateChange) {change_async(storeName, object.id);}
  return store.set(object.id, object);
}

// Helper function to recursively update child objects
const deleteBranch_async = async (config, storeName, store, object) => {
  // Recursively update all child objects
  if (object.meta.childrenId && object.meta.childrenId.length > 0) {
    const promises = object.meta.childrenId.map(async (childId) => {
      let childObject = await read_async(config, storeName, childId);
      return deleteBranch_async(config, storeName, store, childObject);
    });
    await Promise.all(promises);
  }
  store.delete(object.id);
}

export const delete_async = async (config, storeName, id, indicateChange = true) => {
  const store = getStore(config, storeName);
  // We should delete the branch
  const object = await read_async(config, storeName, id)
  await deleteBranch_async(config, storeName, store, object);
  if (indicateChange) {change_async(storeName, id);}
  return store.delete(id);
}

export const update_value_async = async (config, storeName, id, key, value, indicateChange = true) => {
  const object = await read_async(config, storeName, id);
  if (!object) {
    console.log("update_value_async read_async did not find id", id);
  }
  const T = utils.createTaskValueGetter(object);
  console.log("update_value_async id, key, value", id, key, value);
  T(key, value);
  await update_async(config, storeName, T(), indicateChange);
  return T(key)
}

async function uniquifyId_async (config, storeName, objectName, parentObjectId) {
  let uniqueId = parentObjectId + "." + objectName;
  let uniqueIdFound = false;
  let index = 1;
  while (!uniqueIdFound) {
    const conflictingObject = await read_async(config, storeName, uniqueId);
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
const moveBranch_async = async (config, storeName, object, parentObject) => {
  // Build new id for object
  const oldId = object.id;
  object.id = await uniquifyId_async(config, storeName, object.name, parentObject.id);
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
    update_async(config, storeName, parentObject, false),
    delete_async(config, storeName, oldId, false),
    update_async(config, storeName, object, false)
  ]);
  // Recursively update all child objects
  if (object.meta.childrenId && object.meta.childrenId.length > 0) {
    const promises = object.meta.childrenId.map(async (childId) => {
      let childObject = await read_async(config, storeName, childId);
      return moveBranch_async(config, storeName, childObject, object);
    });
    await Promise.all(promises);
  }  
  return object;
};

// Function to move a object to a different parent
export const move_async = async (config, storeName, actionId, destinationId) => {
  try {
    const object = await read_async(config, storeName, actionId);
    // Get current parent object
    const parentObject = await read_async(config, storeName, object.meta.parentId);
    if (!parentObject) throw new Error("Parent object not found " + object.meta.parentId);
    console.log("parentObject", parentObject);
    // Remove object from current parent's children
    parentObject.meta.childrenId = parentObject.meta.childrenId.filter(id => id !== object.id);
    // Update old parent object in the store
    // Get new parent object
    const newParentObject = await read_async(config, storeName, destinationId);
    if (!newParentObject) throw new Error("New parent object not found " + destinationId);
    await Promise.all([
      moveBranch_async(config, storeName, object, newParentObject),
      update_async(config, storeName, parentObject, false)
    ]);
    change_async(storeName, actionId);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the object:", error);
    throw error;
  }
};

const pasteBranch_async = async (config, storeName, object, parentObject) => {
  // Build new id for object
  object.id = await uniquifyId_async(config, storeName, object.name, parentObject.id);
  // Initialize meta.childrenId if it doesn't exist
  parentObject.meta.childrenId = parentObject.meta.childrenId || [];
  // Add new object id to parent's children
  parentObject.meta.childrenId.push(object.id);
  // Update new parent object in the store
  await update_async(config, storeName, parentObject, false);
  // Update parent information for this object
  object.meta.parentId = parentObject.id;
  object.parentName = parentObject.name;
  // Save updated object back to store
  await update_async(config, storeName, object, false);
  //console.log("Pasting object", object.id, "under parent", parentObject.id);
  // Recursively update all child objects
  if (object.meta.childrenId && object.meta.childrenId.length > 0) {
    const promises = object.meta.childrenId.map(async (childId) => {
      let childObject = await read_async(config, storeName, childId);
      await pasteBranch_async(config, storeName, childObject, object);
    });
    await Promise.all(promises);
  }  
};

export const paste_async = async (config, storeName, copiedObjectId, newObjectLabel, destinationId) => {
  try {
    //console.log("paste_async pasting", copiedObjectId, "as", newObjectLabel, "to", destinationId);
    const newObject = await read_async(config, storeName, copiedObjectId);
    const parentObject = await read_async(config, storeName, destinationId);
    newObject.name = newObjectLabel.toLowerCase();
    newObject.config = newObject.config || {};
    newObject.config.label = newObjectLabel;
    await pasteBranch_async(config, storeName, newObject, parentObject);
    change_async(storeName, newObject.id);
  } catch (error) {
    // Handle errors (logging, throw, etc.)
    console.error("An error occurred while moving the object:", error);
    throw error;
  }
}

export const insert_async = async (config, storeName, actionId, newObjectLabel) => {
  try {
    const parentObject = await read_async(config, storeName, actionId);
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
    await update_async(config, storeName, parentObject, false);
    await create_async(config, storeName, newObject, false);
    change_async(storeName, actionId);
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

export const buildTree_async = async (config, storeName) => {

  // Object to hold nodes by their id for quick access
  const nodesById = {
    root: {
      title: 'root',
      id: 'root',
      children: {}
    }
  };

  const store = getStore(config, storeName);
  
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