// Without this we cannot make partial updates to objects in the Task
function deepMerge(prevState, update) {
    const output = { ...prevState };
  
    for (const key of Object.keys(update)) {
      const oldValue = prevState[key];
      const newValue = update[key];
  
      if (newValue === undefined || newValue === null) {
        continue;
      }
  
      if (
        typeof oldValue === "object" &&
        oldValue !== null &&
        !Array.isArray(oldValue) &&
        typeof newValue === "object" &&
        newValue !== null &&
        !Array.isArray(newValue)
      ) {
        output[key] = deepMerge(oldValue, newValue);
      } else {
        output[key] = newValue;
      }
    }
  
    return output;
}

export { deepMerge };