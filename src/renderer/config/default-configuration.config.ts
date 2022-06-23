export const defaultConfiguration: {[key in DefaultConfigKey]: any} = {
    "first-color": "#3b82ff",
    "second-color": "#ff4444"
}

export type DefaultConfigKey = "first-color" | "second-color";