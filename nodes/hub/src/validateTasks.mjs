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
    oneFamily: yup.boolean(),
    collaborateGroupId: yup.string(),
    spawnTask: yup.boolean(),
    nextStates: yup.object(),
    nextTaskTemplate: yup.object(),
    cacheKeySeed: yup.string(),
    caching: yup.array().of(yup.object()),
    local: yup.object(),
    fsm: yup.object(),
    debug: yup.object(),
    background: yup.boolean(),
    autoStartEnvironment: yup.string(),
    autoStartEnvironments: yup.array().of(yup.string()),
    autoStartCoProcessor: yup.boolean(),
    autoStartpriority: yup.string(),
  }).noUnknown(true);

const tasksSchema = yup.array().of(yup.object()
  .shape({
    name: yup.string().required().test('root-if-no-parent', 'Must have a parentName or be named "root"', function(value) {
      const { parentName } = this.parent;
      return parentName || value === 'root';
    }),
    environments: yup.array().of(yup.string()),
    type: yup.string(),
    menu: yup.boolean(),
    parentName: yup.string(),
    permissions: yup.array().of(yup.string()),
    config: configSchema,
    initiator: yup.boolean(),
    state: yup.object({
      current: yup.string(),
    }),
    meta: yup.object(),
    shared: yup.object(),
    services: yup.object().shape({}).defined().test(
      'is-valid-services',
      '${path} must be an object where each key has a certain structure or be absent',
      (value) => {
        if (value == null) {
          return true; // Allows null or undefined
        }
        const serviceSchema = yup.object({
          API: yup.string(),
          modelVersion: yup.string(),
          type: yup.string(),
          forget: yup.boolean(),
          prompt: yup.string(),
          maxTokens: yup.number(),
          maxResponseTokens: yup.number(),
          messagesTemplate: yup.array().of(templateSchema),
          useCache: yup.boolean(),
          systemMessageTemplate: stringOrArrayOfStrings,
          promptTemplate: stringOrArrayOfStrings,
        });
        if (typeof value === 'object') {
          for (const key in value) {
            // eslint-disable-next-line no-prototype-builtins
            if (value.hasOwnProperty(key)) {
              try {
                serviceSchema.validateSync(value[key]);
              } catch (err) {
                return false;
              }
            }
          }
          return true;
        }
        return false;
      }
    ).notRequired(),
    ceps: yup.object(),
    operators: yup.object(),
  })
  .noUnknown(true)
);

function transformKeys(obj) {
  return Object.keys(obj).reduce((result, key) => {
    let newKey = key.replace(/^APPEND_/, '');
    newKey = newKey.replace(/^PREPEND_/, '');
    newKey = newKey.replace(/^LOCAL_/, '');
    newKey = newKey.replace(/^CHILDREN_/, '');
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
  //console.log("Validating tasks", tasks);
  const transformedTasks = tasks.map(taskflow => transformKeys(taskflow));
  await tasksSchema.validate(transformedTasks, { strict: true, noUnknown: true });
  //console.log("Valid tasks");
}