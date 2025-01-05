export enum SteamShortcutKey {
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

type BaseShortcut = {
    [K in SteamShortcutKey]: K extends "tags" ? string[] : string
};

export interface SteamShortcut extends Partial<BaseShortcut> {
    // Mandatory fields
    AppName: string;
    Exe: string;
    StartDir: string;
}
