export function isFunction(value: any): value is Function {
    return !!(value && value.constructor && value.call && value.apply)
}

export function noop() {}
