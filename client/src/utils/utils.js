import { appAbbrev } from '../config'
import _ from 'lodash'
import debug from 'debug'

export function updateState(setState, update) {
    setState(prevState => ({ ...prevState, ...update }))
}

// e.g. delta(() => {updateStep('input')})
export const delta = (callback, delay=0) => setTimeout(callback, delay)

export const getObjectDifference = (obj1, obj2) => {
    const res = _.pickBy(obj1, (value, key) => !_.isEqual(value, obj2[key]))
    return _.cloneDeep(res)
}

export function hasOnlyResponseKey(obj) {
    const keys = Object.keys(obj);
    return keys.length === 1 && keys[0] === 'response'
}

function getCallerName(stackTrace) {
  let callerName = ':unknown';
  // Find caller name for both Chrome and Firefox
  for (const line of stackTrace) {
    const chromeMatch = line.match(/at (.*)\s\(/);
    const firefoxMatch = line.match(/^(.*)@/);
    if (chromeMatch || firefoxMatch) {
      callerName = ':' + (chromeMatch ? chromeMatch[1] : firefoxMatch[1]);
      break;
    }
  }
  if (callerName.indexOf('/') !== -1) { callerName = ':unknown' } // File path probably 
  if (callerName === ':logWithComponent') {
      callerName = ''
  }
  return callerName
}

export const logWithComponent = (componentName, ...message) => {
    const stackTrace = new Error().stack.split('\n')
    const callerName = getCallerName(stackTrace)
    const log = debug(`${appAbbrev}:${componentName}${callerName}`)
    log(...message)
}

export const log = (...message) => {
  const stackTrace = new Error().stack.split('\n')
  const callerName = getCallerName(stackTrace)
  const log = debug(`${appAbbrev}:${callerName}`)
  log(...message)
}
  
export function setArrayState(setArray, idx, t) {
    setArray((prevElements) => {
      const updatedElements = [...prevElements]; // create a copy of the previous state array
      const changedElement = typeof t === 'function' ? t(updatedElements[idx]) : t;
      updatedElements[idx] = changedElement;
      return updatedElements; // return the updated array
    });
}

// Support for dot notation in Task keys
export function setNestedProperties(obj, path = null, value = null) {
  const processKey = (obj, key, value) => {
    if (key.includes('.')) {
      const [head, ...tail] = key.split('.');
      if (!obj.hasOwnProperty(head)) {
        obj[head] = {};
      }
      processKey(obj[head], tail.join('.'), value);
    } else {
       obj[key] = value;
     }
  };

  const processObj = (obj) => {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        processObj(value);
      }
      if (key.includes('.')) {
        //console.log("before", obj)
        processKey(obj, key, value);
        delete obj[key];
        //console.log("after", obj)
      }
    }
  };

  if (path && typeof obj === 'object' && obj !== null) {
    processKey(obj, path, value);
  } else {
    processObj(obj);
  }

  // Note this function operates in-place but it can be useful to have a return value too
  return obj
}

// Without this we cannot make partial updates to objects in the Task
export function deepMerge(prevState, update) {
  const output = { ...prevState };
  
  for (const key of Object.keys(update)) {
    const oldValue = prevState[key];
    const newValue = update[key];

    if (typeof oldValue === 'object' && oldValue !== null && !Array.isArray(oldValue) &&
        typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
      output[key] = deepMerge(oldValue, newValue);
    } else {
      output[key] = newValue;
    }
  }
  
  return output;
}
