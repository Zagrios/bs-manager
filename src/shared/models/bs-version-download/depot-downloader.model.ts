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
    NoValidKeys = "NoValidKey",
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
    AccessDenied = "AccessDenied",
    Unknown = "Unknown",
}

export enum DepotDownloaderWarningEvent {
    ManifestChecksum = "ManifestChecksum",
    ConnectionTimeout = "ConnectionTimeout",
    Unknown = "Unknown",
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