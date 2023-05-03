import { toTaskConverter, taskConverterToJson } from '../shared/taskV02Converter'

// This allows us to upgrade the client task version by incrementally adding to fromV00toV01 and fromV01toV00
// Once the client is upgradaded then we can do the same thing for the server

export function toTask(json) {
    const v02 = toTaskConverter(json)
    const mapped = v02
    return mapped
}

export function fromTask(task) {
    const mapped = task
    return taskConverterToJson(mapped)
}