export enum DepotDownloaderEventType {
    Error = "Error",
    Warning = "Warning",
    Info = "Info",
    
}

export interface DepotDownloaderEvent<T = unknown> {
    type: DepotDownloaderEventType;
    subType: DepotDownloaderEventTypes;
    data?: T;
}

export type DepotDownloaderEventTypes = DepotDownloaderErrorEvent | DepotDownloaderWarningEvent | DepotDownloaderInfoEvent;

export enum DepotDownloaderInfoEvent {
    Start = "Start",
    Password = "Password",
    Guard = "Guard",
    TwoFA = "2FA",
    Progress = "Progress",
    Validated = "Validated",
    Finished = "Finished",
    SteamID = "SteamID",
    QRCode = "QRCode",
    MobileApp = "MobileApp",
}

export enum DepotDownloaderErrorEvent {
    Password = "Password",
    InvalidCredentials = "InvalidCredentials",
    NoManifest = "NoManifest",
    DirectoryCreate = "DirectoryCreate",
    NotAvailableApp = "NotAvailableApp",
    DepotNotFound = "DepotNotFound",
    NotCompleted = "NotCompleted",
    InvalidManifest = "InvalidManifest",
    NoValidKeys = "NoValidKeys",
    NoManifestCode = "NoManifestCode",
    _401 = "401",
    _404 = "404",
    NoServer = "NoServer",
    SteamLib = "SteamLib",
    NotAllowed = "NotAllowed",
    ConnectionTimeout = "ConnectionTimeout",
    ConnectionError = "ConnectionError",
    TokenRejected = "TokenRejected",
    LicenceError = "LicenceError",
    Unknown = "Unknown",
}

export enum DepotDownloaderWarningEvent {
    ManifestChecksum = "ManifestChecksum",
}

export const DepotDownloaderSubTypeOfEventType = {
    [DepotDownloaderEventType.Error]: DepotDownloaderErrorEvent,
    [DepotDownloaderEventType.Warning]: DepotDownloaderWarningEvent,
    [DepotDownloaderEventType.Info]: DepotDownloaderInfoEvent,
}

export interface DepotDownloaderArgsOptions {
    app: number|string,
    depot: number|string,
    manifest: number|string,
    username?: string,
    password?: string,
    "remember-password"?: boolean,
    dir: string,
    validate?: boolean,
    qr?: boolean,
}