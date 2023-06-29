import * as yup from 'yup';
import { configSchema } from "./validateConfig.mjs";

const taskSchema = yup.object()
  .shape({
    id: yup.string(),
    name: yup.string(),
    stack: yup.array().of(yup.string()),
    stackTaskId: yup.array().of(yup.string()),
    menu: yup.boolean(),
    parentType: yup.string(),
    permissions: yup.array().of(yup.string()),
    config: configSchema,
    label: yup.string(),
    initiator: yup.boolean(),
    meta: yup.object({
      locked: yup.boolean(),
    }),
    websocket: yup.boolean(),
    environments: yup.array().of(yup.string()),
    state: yup.object({
      current: yup.string(),
    }),
    output: yup.object({
    })
  }).noUnknown(true);

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

  export const validateTasks = async (tasks) => {
    const transformedTasks = transformKeys(tasks);
    //console.log("transformedTasks", transformedTasks);
    const objectSchema = yup.object().shape(
      Object.keys(transformedTasks).reduce((schema, key) => {
        schema[key] = taskSchema;
        return schema;
      }, {})
    ).noUnknown(true);
    await objectSchema.validate(transformedTasks, { strict: true, noUnknown: true });
    console.log("Valid tasks");
  };