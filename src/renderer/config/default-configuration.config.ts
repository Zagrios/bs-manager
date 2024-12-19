import { BsvSearchOrder } from "shared/models/maps/beat-saver.model";

// NOTE: To refactor. Rename to LocalStorageConfigKeyValues since these are stored in the
//   localStorage in the browser, and for readability
export interface DefaultConfigKeyValues {
    "first-color": string;
    "second-color": string;
    theme: ThemeConfig;
    language: string;
    supported_languages: string[];
    default_mods: string[];
    "default-shared-folders": string[];
    "playlist-sort-order": BsvSearchOrder;
    "map-sort-order": BsvSearchOrder;
};

export type DefaultConfigKey = keyof DefaultConfigKeyValues;

export const defaultConfiguration: {
    [key in DefaultConfigKey]: DefaultConfigKeyValues[key]
} = {
    "first-color": "#3b82ff",
    "second-color": "#ff4444",
    theme: "os",
    language: window.navigator.language.length <= 2 ? `${window.navigator.language}-${window.navigator.language.toLocaleUpperCase()}` : window.navigator.language,
    supported_languages: ["en-US", "en-EN", "fr-FR", "es-ES", "de-DE", "ru-RU", "zh-CN", "zh-TW", "ja-JP", "ko-KR"],
    default_mods: ["SongCore", "WhyIsThereNoLeaderboard", "BeatSaverDownloader", "BeatSaverVoting", "PlaylistManager"],
    "default-shared-folders": [
        window.electron.path.join("Beat Saber_Data", "CustomLevels"),
        window.electron.path.join("Beat Saber_Data", "CustomWIPLevels"),
    ],
    "playlist-sort-order": BsvSearchOrder.Relevance,
    "map-sort-order": BsvSearchOrder.Relevance,
};

export type ThemeConfig = "dark" | "light" | "os";

