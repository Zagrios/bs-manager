import { execOnOs } from "../../helpers/env.helpers";
import path from "path";
import { Log } from "../../decorators/log.decorator";

const { list, createKey, putValue, deleteKey, RegSzValue } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as typeof import("regedit-rs");

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

    public async isLivInstalled(): Promise<boolean> {
        return execOnOs({
            win32: async () => {
                const regRes = await list(this.livRegeditKey).then(res => res[this.livRegeditKey]);
                return regRes.exists;
            },
        }, true);
    }

    public async createLivShortcut(entry: LivEntry): Promise<void> {
        return execOnOs({
            win32: async () => {
                const livExternalAppRegeditKey = path.join(this.livExternalAppsRegeditKey, entry.id);
                await createKey(livExternalAppRegeditKey);
                await putValue({
                    [livExternalAppRegeditKey]: {
                        InstallPath: new RegSzValue(entry.installPath),
                        Executable: new RegSzValue(entry.executable),
                        Arguments: new RegSzValue(entry.arguments),
                        Name: new RegSzValue(entry.name)
                    }
                });
            }
        });
    }

    public async deleteLivShortcuts(ids: string[]): Promise<void> {
        return execOnOs({
            win32: async () => {
                const shotcutsKeys = ids.map(id => path.join(this.livExternalAppsRegeditKey, id));
                return deleteKey(shotcutsKeys);
            }
        })
    }

    public getLivShortcuts(): Promise<LivEntry[]> {

        return execOnOs({
            win32: async () => {
                const regRes = await list(this.livExternalAppsRegeditKey).then(res => res[this.livExternalAppsRegeditKey]);

                if(!regRes.exists){
                    return [];
                }

                const promises = regRes.keys.map(async key => {
                    const shortcutKey = path.join(this.livExternalAppsRegeditKey, key);
                    const entries = await list(shortcutKey).then(res => res[shortcutKey]);

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

