import { app } from "electron";
import path from "path";

export const BS_EXECUTABLE = "Beat Saber.exe";
export const OCULUS_BS_DIR = "hyperbolic-magnetism-beat-saber";
export const OCULUS_BS_BACKUP_DIR = `${OCULUS_BS_DIR}.bsmbak`;
export const BS_APP_ID = "620980";
export const BS_DEPOT = "620981";
export const APP_NAME = "BSManager";

export const STEAMVR_APP_ID = "250820";

export const IMAGE_CACHE_FOLDER = "imagescache";
export const IMAGE_CACHE_PATH = path.join(app.getPath("userData"), IMAGE_CACHE_FOLDER);
