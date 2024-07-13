import { FileFilter } from "electron";

export interface OpenSaveDialogOption {
    filename?: string;
    filters?: FileFilter[];
}
