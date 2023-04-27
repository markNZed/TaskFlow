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

export const logWithComponent = (componentName, ...message) => {
    const stackTrace = new Error().stack.split('\n')
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
    const log = debug(`${appAbbrev}:${componentName}${callerName}`)
    log(...message)
}