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