import { toTaskConverter, taskConverterToJson } from '../shared/taskConverter'
import { fromV00toV01, fromV01toV00 } from '../shared/taskVersionMap'

// This allows us to upgrade the client task version by incrementally adding to fromV00toV01 and fromV01toV00
// Once the client is upgradaded then we can do the same thing for the server

export function toTask(json) {
    const v00 = toTaskConverter(json)
    const mapped = fromV00toV01(v00)
    //const mapped = v00
    return mapped
}

export function fromTask(task) {
    const mapped = fromV01toV00(task)
    //const mapped = task
    return taskConverterToJson(mapped)
}