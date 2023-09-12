import { execOnOs } from "../helpers/env.helpers";
import path from "path";
import regedit from "regedit";

export class LivService {

    private static instance: LivService;

    public static getInstance(): LivService {
        if (!LivService.instance) {
            LivService.instance = new LivService();
        }
        return LivService.instance;
    }

    private readonly livRegeditKey: string = path.join("HKCU", "SOFTWARE", "LIV.App");

    private constructor() {

    }

    public isLivInstalled(): Promise<boolean> {
        return execOnOs({
            win32: async () => {
                const regRes = await regedit.promisified.list([this.livRegeditKey]).then(res => res[this.livRegeditKey]);
                return regRes !== undefined && regRes.exists;
            }
        });
    }

    public async createLivShortcut(entry: LivEntry): Promise<void> {
        return execOnOs({
            win32: async () => {
                const livExternalAppsRegeditKey = path.join(this.livRegeditKey, "ExternalApplications", entry.id);
                await regedit.promisified.createKey([livExternalAppsRegeditKey]);
                await regedit.promisified.putValue({
                    [livExternalAppsRegeditKey]: {
                        "InstallPath": {
                            value: entry.installPath,
                            type: "REG_SZ"
                        },
                        "Executable": {
                            value: entry.executable,
                            type: "REG_SZ"
                        },
                        "Arguments": {
                            value: entry.arguments,
                            type: "REG_SZ"
                        },
                        "Name": {
                            value: entry.name,
                            type: "REG_SZ"
                        }
                    }
                });
            }
        });
    }

}

export interface LivEntry {
    id: string,
    name: string,
    installPath: string,
    executable: string,
    arguments: string
}

