import { appAbbrev } from '../config'
import _ from 'lodash'
import debug from 'debug'

export function updateState(setState, update) {
    setState(prevState => ({ ...prevState, ...update }))
}

// e.g. delta(() => {updateStep('input')})
export const delta = (callback, delay=0) => setTimeout(callback, delay)

export const getObjectDifference = (obj1, obj2) => {
    return _.pickBy(obj1, (value, key) => !_.isEqual(value, obj2[key]))
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
  
// Set a task in an array, could have helper function for this in utils (pass in array, index, update)
export function setArrayState(setArray, idx, t) {
    setArray((prevElements) => {
      const updatedElements = [...prevElements]; // create a copy of the previous state array
      const changedElement = typeof t === 'function' ? t(updatedElements[idx]) : t;
      updatedElements[idx] = changedElement;
      return updatedElements; // return the updated array
    });
}
