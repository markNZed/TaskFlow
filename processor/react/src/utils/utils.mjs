import { appAbbrev } from "../config.mjs";
import _ from "lodash";
import debug from "debug";
import { utils as sharedUtils } from "../shared/utils.mjs"

const utils = {

  ...sharedUtils,

  hasOnlyResponseKey: function(obj) {
    const keys = Object.keys(obj);
    return keys.length === 1 && keys[0] === "response";
  },

  getCallerName: function(stackTrace) {
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
  },

  logWithComponent: (componentName, ...message) => {
    //console.log(...message)
    const stackTrace = new Error().stack.split("\n");
    const callerName = utils.getCallerName(stackTrace);
    const log = debug(`${appAbbrev}:${componentName}${callerName}`);
    log(...message);
  },

  // Should not create debug each time, should create log locally
  log: (...message) => {
    //console.log(...message)
    const stackTrace = new Error().stack.split("\n");
    const callerName = utils.getCallerName(stackTrace);
    const log = debug(`${appAbbrev}:${callerName}`);
    log(...message);
  },

  setArrayState: function(setArray, idx, t) {
    setArray((prevElements) => {
      const updatedElements = [...prevElements]; // create a copy of the previous state array
      const changedElement =
        typeof t === "function" ? t(updatedElements[idx]) : t;
      updatedElements[idx] = changedElement;
      return updatedElements; // return the updated array
    });
  },

  setNestedProperties: function(obj, path, value) {
    // Validate input object
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Input must be a non-null object.');
    }

    // If called with just an object, apply the rules of splitting top-level keys
    if (arguments.length === 1) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const keys = key.split('.');
          let currentObj = obj;
          for (let i = 0; i < keys.length; i++) {
            const subKey = keys[i];
            if (i === keys.length - 1) {
              currentObj[subKey] = obj[key];
            } else {
              currentObj[subKey] = currentObj[subKey] || {};
              currentObj = currentObj[subKey];
            }
          }
        }
      }
      // Clear the original keys after creating the nested structure
      for (const key in obj) {
        if (key.includes('.')) {
          delete obj[key];
        }
      }
      return obj; // Return the modified original object
    }

    // Validate path
    if (path === '') {
      throw new Error('Invalid empty key provided.');
    }

    const processKey = (obj, key, value) => {
      // Check for empty key or key with only dots
      if (!key || key.split('.').every(subKey => subKey === '')) {
        throw new Error('Invalid key provided:' + key);
      }

      // Split the key into top-level and remaining parts
      const [head, ...tail] = key.split('.');

      // If the exact key exists at the top level, set it directly
      if (obj.hasOwnProperty(head)) {
        // This is OK at a leaf i.e., tail.length === 0
        if (typeof obj[head] !== 'object' && tail.length > 0) {
          throw new Error('Cannot set a nested property on a non-object value');
        }
        if (tail.length === 0) {
          obj[head] = value;
        } else {
          processKey(obj[head], tail.join('.'), value);
        }
      } else {
        // If the key does not exist at the top level, create it
        if (tail.length === 0) {
          obj[head] = value;
        } else {
          obj[head] = {};
          processKey(obj[head], tail.join('.'), value);
        }
      }
    };

    processKey(obj, path, value);
    return obj; // Return the modified original object
  },


  replaceNewlinesWithParagraphs: function(text) {
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
  },

};

export { utils };