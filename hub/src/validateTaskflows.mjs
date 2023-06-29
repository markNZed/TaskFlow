import * as yup from 'yup';
import { configSchema } from "./validateConfig.mjs";

const taskflowsSchema = yup.array().of(yup.object()
  .shape({
    name: yup.string().required(),
    stack: yup.array().of(yup.string()),
    stackTaskId: yup.array().of(yup.string()),
    menu: yup.boolean(),
    parentType: yup.string(),
    permissions: yup.array().of(yup.string()),
    config: configSchema,
    initiator: yup.boolean(),
    tasks: yup.object().test('is-task-object', 'The tasks object is not valid', (tasks) => {
      if (!tasks) return true;  // If tasks is not defined, validation passes

      // Define a schema for individual tasks
      const taskSchema = yup.object({
        config: configSchema,
        response: yup.object({
          text: yup.string(),
          userInput: yup.string(),
        }),
      });

      // Loop through tasks and validate each one against taskSchema
      for (let task in tasks) {
        let isValid;
        try {
          isValid = taskSchema.validateSync(tasks[task]);
        } catch (error) {
          throw error;
          console.log(`Validation error in task '${task}':`, error.errors);
          return false;
        }
        if (!isValid) return false;  // If any task is invalid, fail the validation
      }
      
      // If all tasks pass validation, return true
      return true;
    }),
  })
  .noUnknown(true)
);

function transformKeys(obj) {
  return Object.keys(obj).reduce((result, key) => {
    const newKey = key.replace(/^APPEND_/, '');
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      result[newKey] = transformKeys(obj[key]);  // Recursively transform keys of nested object
    } else {
      result[newKey] = obj[key];
    }
    return result;
  }, {});
}

export const validateTaskflows = async (taskflows) => {
  const transformedTaskflows = taskflows.map(taskflow => transformKeys(taskflow));
  await taskflowsSchema.validate(transformedTaskflows, { strict: true, noUnknown: true });
  console.log("Valid taskflows");
}