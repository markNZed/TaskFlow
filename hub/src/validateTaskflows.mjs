import * as yup from 'yup';

const stringOrArrayOfStrings = yup
  .mixed()
  .test(
    'is-string-or-array',
    'Content must be a string or an array of strings',
    (value) =>
    value === undefined || typeof value === 'string' ||
      (Array.isArray(value) && value.every((item) => typeof item === 'string' || value === ''))
  );

const templateSchema = yup.object({
  role: yup.string().required(),
  text: stringOrArrayOfStrings.required(),
}).noUnknown(true);

export const configSchema = yup.object()
  .shape({
  maxRequestCount: yup.number(),
  maxRequestRate: yup.number(),
  label: yup.string(),
  nextTask: yup.string(),
  instruction: yup.string(),
  oneFamily: yup.boolean(),
  useAddress: yup.boolean(),
  promptWithTime: yup.boolean(),
  promptPlaceholder: yup.string(),
  collaborateGroupId: yup.string(),
  spawnTask: yup.boolean(),
  nextStates: yup.object(),
  nextTaskTemplate: yup.object(),
  responseTemplate: stringOrArrayOfStrings,
  model: yup.object({
    base: yup.string(),
    type: yup.string(),
    forget: yup.boolean(),
    prompt: yup.string(),
    maxTokens: yup.number(),
    messagesTemplate: yup.array().of(templateSchema),
    useCache: yup.boolean(),
  }),
  inputLabel: yup.string(),
  response: yup.string(),
  messagesTemplate: yup.array().of(templateSchema),
  suggestedPrompts: stringOrArrayOfStrings,
  systemMessageTemplate: stringOrArrayOfStrings,
  promptTemplate: stringOrArrayOfStrings,
  welcomeMessage: stringOrArrayOfStrings,
}).noUnknown(true);

const taskflowsSchema = yup.array().of(yup.object()
  .shape({
    name: yup.string().required().test('root-if-no-parent', 'Must have a parentName or be named "root"', function(value) {
      const { parentName } = this.parent;
      return parentName || value === 'root';
    }),
    type: yup.string(),
    menu: yup.boolean(),
    parentName: yup.string(),
    permissions: yup.array().of(yup.string()),
    config: configSchema,
    initiator: yup.boolean(),
    state: yup.object({
      current: yup.string(),
    }),
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
    let newKey = key.replace(/^APPEND_/, '');
    newKey = newKey.replace(/_(FR|EN)$/, '');
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