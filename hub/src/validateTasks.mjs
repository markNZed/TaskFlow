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
  service: yup.object({
    base: yup.string(),
    type: yup.string(),
    forget: yup.boolean(),
    prompt: yup.string(),
    maxTokens: yup.number(),
    maxResponseTokens: yup.number(),
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
  cacheKeySeed: yup.string(),
  cache: yup.array().of(yup.object()),
  fields: yup.array().of(yup.object({ 
    type: yup.string(),
    options: yup.array().of(yup.object({
      // value can be boolean, string, or number
      value: yup.mixed().required(),
      label: yup.string().required(),
    })),
  })),
  regexProcess: yup.object(),
  regexProcessPrompt: yup.array(),
  regexProcessResponse: yup.array(),
  regexProcessMessages: yup.array(),
  introductionPrompt: yup.string(),
}).noUnknown(true);

const tasksSchema = yup.array().of(yup.object()
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
  })
  .noUnknown(true)
);

function transformKeys(obj) {
  return Object.keys(obj).reduce((result, key) => {
    let newKey = key.replace(/^APPEND_/, '');
    newKey = newKey.replace(/^PREPEND_/, '');
    newKey = newKey.replace(/^PRIVATE_/, '');
    newKey = newKey.replace(/_(FR|EN)$/, '');
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      result[newKey] = transformKeys(obj[key]);  // Recursively transform keys of nested object
    } else {
      result[newKey] = obj[key];
    }
    return result;
  }, {});
}

export const validateTasks = async (tasks) => {
  const transformedTasks = tasks.map(taskflow => transformKeys(taskflow));
  await tasksSchema.validate(transformedTasks, { strict: true, noUnknown: true });
  console.log("Valid tasks");
}