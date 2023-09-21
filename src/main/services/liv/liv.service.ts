import { execOnOs } from "../../helpers/env.helpers";
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
    private readonly livExternalAppsRegeditKey: string = path.join(this.livRegeditKey, "ExternalApplications");

    private constructor() {

    }

    public isLivInstalled(): Promise<boolean> {
        return execOnOs({
            win32: async () => {
                const regRes = await regedit.promisified.list([this.livRegeditKey]).then(res => res[this.livRegeditKey]);
                return regRes?.exists;
            },
            linux: async() => false,
        });
    }

    public async createLivShortcut(entry: LivEntry): Promise<void> {
        return execOnOs({
            win32: async () => {
                const livExternalAppRegeditKey = path.join(this.livExternalAppsRegeditKey, entry.id);
                await regedit.promisified.createKey([livExternalAppRegeditKey]);
                await regedit.promisified.putValue({
                    [livExternalAppRegeditKey]: {
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

    public async deleteLivShortcuts(ids: string[]): Promise<void> {
        return execOnOs({
            win32: async () => {
                const shotcutsKeys = ids.map(id => path.join(this.livExternalAppsRegeditKey, id));
                return regedit.promisified.deleteKey(shotcutsKeys);
            }
        })
    }

    public getLivShortcuts(): Promise<LivEntry[]> {
        return execOnOs({
            win32: async () => {
                const regRes = await regedit.promisified.list([this.livExternalAppsRegeditKey]).then(res => res[this.livExternalAppsRegeditKey]);
                
                if(!regRes.exists){
                    return [];
                }

                const promises = regRes.keys.map(async key => {
                    const shortcutKey = path.join(this.livExternalAppsRegeditKey, key);
                    const entries = await regedit.promisified.list([shortcutKey]).then(res => res[shortcutKey]);

                    if(!entries.exists){
                        return undefined;
                    }

                    return {
                        id: key,
                        name: entries.values.Name.value,
                        installPath: entries.values.InstallPath.value,
                        executable: entries.values.Executable.value,
                        arguments: entries.values.Arguments.value
                    } as LivEntry;
                });

                return Promise.all(promises).then(entries => entries.filter(Boolean));
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

