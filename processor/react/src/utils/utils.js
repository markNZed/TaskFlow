import { appAbbrev } from "../config";
import _ from "lodash";
import debug from "debug";
import { deepMerge, deepCompare, checkConflicts, getObjectDifference, updatedAt } from "../shared/utils.mjs"

export { deepMerge, deepCompare, checkConflicts, getObjectDifference, updatedAt }

// e.g. delta(() => {modifyState('input')})
export const delta = (callback, delay = 0) => setTimeout(callback, delay);

export function hasOnlyResponseKey(obj) {
  const keys = Object.keys(obj);
  return keys.length === 1 && keys[0] === "response";
}

function getCallerName(stackTrace) {
  let callerName = ":unknown";
  // Find caller name for both Chrome and Firefox
  for (const line of stackTrace) {
    const chromeMatch = line.match(/at (.*)\s\(/);
    const firefoxMatch = line.match(/^(.*)@/);
    if (chromeMatch || firefoxMatch) {
      callerName = ":" + (chromeMatch ? chromeMatch[1] : firefoxMatch[1]);
      break;
    }
  }
  if (callerName.indexOf("/") !== -1) {
    callerName = ":unknown";
  } // File path probably
  if (callerName === ":logWithComponent") {
    callerName = "";
  }
  return callerName;
}

export const logWithComponent = (componentName, ...message) => {
  //console.log(...message)
  const stackTrace = new Error().stack.split("\n");
  const callerName = getCallerName(stackTrace);
  const log = debug(`${appAbbrev}:${componentName}${callerName}`);
  log(...message);
};

// Should not create debug each time, should create log locally
export const log = (...message) => {
  //console.log(...message)
  const stackTrace = new Error().stack.split("\n");
  const callerName = getCallerName(stackTrace);
  const log = debug(`${appAbbrev}:${callerName}`);
  log(...message);
};

export function setArrayState(setArray, idx, t) {
  setArray((prevElements) => {
    const updatedElements = [...prevElements]; // create a copy of the previous state array
    const changedElement =
      typeof t === "function" ? t(updatedElements[idx]) : t;
    updatedElements[idx] = changedElement;
    return updatedElements; // return the updated array
  });
}

// Support for dot notation in Task keys
export function setNestedProperties(obj, path = null, value = null) {
  const processKey = (obj, key, value) => {
    if (key.includes(".")) {
      const [head, ...tail] = key.split(".");
      if (!obj.hasOwnProperty(head)) {
        obj[head] = {};
      }
      processKey(obj[head], tail.join("."), value);
    } else {
      obj[key] = value;
    }
  };

  const processObj = (obj) => {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        processObj(value);
      }
      if (key.includes(".")) {
        //console.log("before", obj)
        processKey(obj, key, value);
        delete obj[key];
        //console.log("after", obj)
      }
    }
  };

  if (path && typeof obj === "object" && obj !== null) {
    processKey(obj, path, value);
  } else {
    processObj(obj);
  }

  // Note this function operates in-place but it can be useful to have a return value too
  return obj;
}

export function replaceNewlinesWithParagraphs(text) {
  let html = ""
  if (text) {
    // Split the text on one or more newline characters to get an array of lines
    var lines = text.split(/\n+/);

    // Trim whitespace from each line and remove any empty ones
    lines = lines.map(line => line.trim()).filter(line => line !== '');

    // Wrap each line in <p> tags
    html = lines.map(line => `<p>${line}</p>`).join('');
  }
  return html;
}
