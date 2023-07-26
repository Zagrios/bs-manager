import { BSVersion } from "shared/bs-version.interface";
import { MSModel, MSModelType } from "./model-saber.model";

export interface BsmLocalModel {
    readonly path: string;
    readonly fileName: string;
    readonly hash: string;
    readonly type: MSModelType;
    readonly model?: MSModel;
    readonly version?: BSVersion;
}
