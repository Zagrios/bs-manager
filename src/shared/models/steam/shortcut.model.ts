enum SteamShortcutKey {
    AppName = "AppName",
    Exe = "Exe",
    StartDir = "StartDir",
    appid = "appid",
    icon = "icon",
    ShortcutPath = "ShortcutPath",
    LaunchOptions = "LaunchOptions",
    IsHidden = "IsHidden",
    AllowDesktopConfig = "AllowDesktopConfig",
    OpenVR = "OpenVR",
    Devkit = "Devkit",
    DevkitGameID = "DevkitGameID",
    LastPlayTime = "LastPlayTime",
    FlatpakAppID = "FlatpakAppID",
    tags = "tags"
}

type BaseShortcutData = {
    [K in SteamShortcutKey]: K extends "tags" ? string[] : string
};

export interface SteamShortcutData extends Partial<BaseShortcutData> {
    // Mandatory and specific values
    AppName: string;
    Exe: string;
    StartDir: string;
    OpenVR?: "\x01" | "\x00";
}

export class SteamShortcut {

    public static parseShortcutsRawData(rawData: string): SteamShortcut[] {
        // Code taken from: https://developer.valvesoftware.com/wiki/Steam_Library_Shortcuts#Reading_the_shortcuts.vdf

        const startIndex = rawData.indexOf("\u0000shortcuts\u0000");
        if (startIndex < 0) {
            return [];
        }
        const start = startIndex + "\u0000shortcuts\u0000".length;
        const end = rawData.lastIndexOf("\u0008\u0008");
        if (end < 0 || end <= start) {
            return [];
        }

        const shortcutsString = rawData.substring(start, end - start);

        const result: SteamShortcutData[] = [];
        let currentShortcut: SteamShortcutData | null = null;
        let word = "";
        let key = "";
        let readingTags = false;
        let tagId = -1;

        const shortcutKeysRegex = new RegExp(`[\u0001\u0002](${Object.values(SteamShortcutKey).join("|")})`, "i");

        for (const c of shortcutsString) {

            if (c === "\u0000") {
                if (word.endsWith(`\u0001${SteamShortcutKey.AppName}`)) {
                    if (currentShortcut) {
                        result.push(currentShortcut);
                    }
                    currentShortcut = {
                        AppName: "",
                        Exe: "",
                        StartDir: "",
                        icon: "",
                        LaunchOptions: "",
                        IsHidden: "\x00",
                    };
                    key = `\u0001${SteamShortcutKey.AppName}`;
                } else if (shortcutKeysRegex.test(word)) {
                    key = word;
                } else if (word === SteamShortcutKey.tags) {
                    readingTags = true;
                } else if (key !== "") {
                    const currentKey = shortcutKeysRegex.exec(key).pop().replaceAll("\u0001", "").replaceAll("\u0002", "") as SteamShortcutKey;
                    if (currentShortcut && currentKey && currentKey !== SteamShortcutKey.tags) {
                        currentShortcut[currentKey] = word.replaceAll("\"", "") as string & ("\x01" | "\x00") // Make TS happy
                    }
                    key = "";
                } else if (readingTags) {
                    if (word.startsWith("\u0001")) {
                        tagId = parseInt(word.substring(1), 10);
                    } else if (tagId >= 0 && currentShortcut) {
                        currentShortcut.tags.push(word);
                        tagId = -1;
                    } else {
                        readingTags = false;
                    }
                }
                word = "";
            } else {
                word += c;
            }
        }

        if (currentShortcut) {
            result.push(currentShortcut);
        }

        return result.map(shortcutData => new SteamShortcut(shortcutData));
    }

    public static getShortcutsString(shortcuts: SteamShortcut[]): string {
        let shortcutsString = "\u0000shortcuts\u0000";
        for (let i = 0; i < shortcuts.length; i++) {
            const shortcut = shortcuts[i];
            if(!shortcut.data?.AppName || !shortcut.data?.Exe || !shortcut.data?.StartDir) {
                continue;
            }
            shortcutsString += `\u0000${i}\u0000`;
            shortcutsString += shortcut.getStringBytes();
        }
        shortcutsString += "\u0008\u0008";
        return shortcutsString;
    }

    private data: SteamShortcutData;

    public constructor(shortcutData: SteamShortcutData) {
        this.data = shortcutData;
    }

    public getStringBytes(): string {

        const isHidden = this.data?.IsHidden === "\x01";
        const allowDesktopConfig = this.data?.AllowDesktopConfig === "\x01";
        const allowOverlay = this.data?.AllowDesktopConfig === "\x01";
        const openVR = this.data?.OpenVR === "\x01";
        const devkit = this.data?.Devkit === "\x01";

        let strShortcut = "";

        strShortcut += `\x02appid\x00${this.data?.appid || "\x00\x00\x00"}\x00`;
        strShortcut += `\x01AppName\x00${this.data?.AppName ?? ""}\x00`;
        strShortcut += `\x01Exe\x00\"${this.data?.Exe ?? ""}\"\x00`;
        strShortcut += `\x01StartDir\x00\"${this.data?.StartDir ?? ""}\"\x00`;
        strShortcut += `\x01icon\x00${this.data?.icon ?? ""}\x00`;
        strShortcut += `\x01ShortcutPath\x00\x00`;
        strShortcut += `\x01LaunchOptions\x00${this.data?.LaunchOptions ?? ""}\x00`;
        strShortcut += `\x02IsHidden\x00${isHidden ? "\x01" : "\x00"}\x00\x00\x00`;
        strShortcut += `\x02AllowDesktopConfig\x00${allowDesktopConfig ? "\x01" : "\x00"}\x00\x00\x00`;
        strShortcut += `\x02AllowOverlay\x00${allowOverlay ? "\x01" : "\x00"}\x00\x00\x00`;
        strShortcut += `\x02OpenVR\x00${openVR ? "\x01" : "\x00"}\x00\x00\x00`;
        strShortcut += `\x02Devkit\x00${devkit ? "\x01" : "\x00"}\x00\x00\x00`;
        strShortcut += `\x01DevkitGameID\x00${this.data?.DevkitGameID ?? ""}\x00`;
        strShortcut += `\x02DevkitOverrideAppID\x00\x00\x00\x00\x00`;
        strShortcut += `\x02LastPlayTime\x00\x00\x00\x00\x00`;
        strShortcut += `\x00tags\x00${""}\x08\x08`;

        return strShortcut;
    }

}
