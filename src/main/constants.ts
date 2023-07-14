import { app } from "electron";
import path from "path";

export const BS_EXECUTABLE = "Beat Saber.exe";
export const OCULUS_BS_DIR = "hyperbolic-magnetism-beat-saber";
export const BS_APP_ID = "620980";
export const BS_DEPOT = "620981";
export const APP_NAME = "BSManager";

export const STEAMVR_APP_ID = "250820";

export const IMAGE_CACHE_FOLDER = "imagescache";
export const IMAGE_CACHE_PATH = path.join(path.dirname(app.getPath("exe")), IMAGE_CACHE_FOLDER);
