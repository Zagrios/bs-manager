export const defaultConfiguration: {[key in DefaultConfigKey]: any} = {
    "first-color": "#3b82ff",
    "second-color": "#ff4444",
    "theme": "os"
}

export type DefaultConfigKey = "first-color" | "second-color" | "theme";

export type ThemeConfig = "dark" | "light" | "os"