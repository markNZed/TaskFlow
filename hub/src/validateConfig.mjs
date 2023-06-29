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
  maxUpdateCount: yup.number(),
  maxUpdateRate: yup.number(),
  label: yup.string(),
  nextTask: yup.string(),
  instruction: yup.string(),
  oneFamily: yup.boolean(),
  useAddress: yup.boolean(),
  promptWithTime: yup.boolean(),
  promptPlaceholder: yup.string(),
  collaborateGroupId: yup.string(),
  spawn: yup.boolean(),
  nextStates: yup.object(),
  nextStateTemplate: yup.object(),
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