import { app } from "electron";
import { constants } from "http2";
import path from "path";

export const BS_EXECUTABLE = "Beat Saber.exe";
export const OCULUS_BS_DIR = "hyperbolic-magnetism-beat-saber";
export const OCULUS_BS_BACKUP_DIR = `${OCULUS_BS_DIR}.bsmbak`;
export const BS_APP_ID = "620980";
export const BS_DEPOT = "620981";
export const APP_NAME = "BSManager";

export const STEAMVR_APP_ID = "250820";

export const CACHE_PATH = path.join(app.getPath("userData"), "CachedData");

export const IMAGE_CACHE_PATH = path.join(CACHE_PATH, "imagescache");

export const HTTP_STATUS_CODES = constants;

// Linux related stuff

export const PROTON_BINARY_PREFIX = "proton";
export const WINE_BINARY_PREFIX = path.join("files", "bin", "wine64");
export const IS_FLATPAK = process.env.container === "flatpak";

