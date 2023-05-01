import { toTaskConverter, taskConverterToJson } from '../shared/taskV01Converter'
import { fromV01toV02, fromV02toV01 } from '../shared/taskV01toV02Map'

// This allows us to upgrade the client task version by incrementally adding to fromV00toV01 and fromV01toV00
// Once the client is upgradaded then we can do the same thing for the server

export function toTask(json) {
    const v01 = toTaskConverter(json)
    const mapped = fromV01toV02(v01)
    //const mapped = v01
    return mapped
}

export function fromTask(task) {
    const mapped = fromV02toV01(task)
    //const mapped = task
    return taskConverterToJson(mapped)
}