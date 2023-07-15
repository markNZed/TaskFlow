import {
  toTaskConverter,
  taskConverterToJson,
} from "./shared/taskV02Converter.mjs";

// This allows us to upgrade the client task version by incrementally adding to fromV00toV01 and fromV01toV00
// Once the client is upgradaded then we can do the same thing for the RxJS Task Processor

export function toTask(json) {
  const v01 = toTaskConverter(json);
  const mapped = v01;
  return mapped;
}

export function fromTask(task) {
  const mapped = task;
  return taskConverterToJson(mapped);
}
