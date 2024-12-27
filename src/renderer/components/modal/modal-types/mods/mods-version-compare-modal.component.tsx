import { useEffect, useState } from "react";
import { logRenderError } from "renderer";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent } from "renderer/services/modale.service";
import { lastValueFrom } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { safeLt } from "shared/helpers/semver.helpers";
import { Mod } from "shared/models/mods";

enum Mode {
    All = "all",
    Installed = "installed",
    NotInstalled = "not-installed",
}

function useHeader({
    version,
    loading,
    setLoading,
}: Readonly<{
    version: BSVersion;
    loading: boolean;
    setLoading: (loading: boolean) => void;
}>) {
    const ipc = useService(IpcService);

    const [mode, setMode] = useState(Mode.All);
    const [otherVersion, setOtherVersion] = useState(null as BSVersion | null);
    const [otherAvailableModsMap, setOtherAvailableModsMap] = useState(new Map<string, Mod[]>());
    const [otherInstalledModsMap, setOtherInstalledModsMap] = useState(new Map<string, Mod[]>());

    const modeOptions: BsmSelectOption<Mode>[] = useConstant(() =>
        Object.values(Mode).map(val => ({
            text: `modals.mods-version-compare.mod-types.${val}`,
            value: val,
        }))
    );
    const [versionOptions, setVersionOptions] = useState(
        [] as BsmSelectOption<BSVersion | null>[]
    );

    useEffect(() => {
        Promise.all([
            lastValueFrom(ipc.sendV2("bs-version.get-version-dict")),
            lastValueFrom(ipc.sendV2("bs-version.installed-versions")),
        ])
            .then(([availableVersions, installedVersions]) => {
                setVersionOptions([
                    {
                        text: "modals.mods-version-compare.select-version",
                        value: null
                    },
                    ...installedVersions
                        .filter(v => v.BSVersion !== version.BSVersion)
                        .sort((v1, v2) => {
                            if (v1.steam) return -1;
                            if (v2.steam) return 1;

                            if (v1.oculus) return -1;
                            if (v2.oculus) return 1;

                            if (v1.BSVersion === v2.BSVersion)
                                return v1.name.localeCompare(v2.name);
                            return safeLt(v1.BSVersion, v2.BSVersion) ? 1 : -1;
                        })
                        .map(v => {
                            let {name} = v;
                            if (v.steam) {
                                name = "Steam";
                            } else if (v.oculus) {
                                name = "Oculus";
                            }

                            return {
                                text: `${v.BSVersion} - ${name}`,
                                value: v
                            };
                        }),
                    ...availableVersions
                        .filter(v => v.BSVersion !== version.BSVersion)
                        .map(v => ({ text: v.BSVersion, value: v }))
                        .sort((v1, v2) => safeLt(v1.text, v2.text) ? 1 : -1)
                ]);
            })
            .catch(error => logRenderError("Could not load versions dict", error));
    }, []);

    // NOTE: Can be memoized/cached
    useEffect(() => {
        const availableMap = new Map<string, Mod[]>();
        const installedMap = new Map<string, Mod[]>();
        if (!otherVersion) {
            setOtherAvailableModsMap(availableMap);
            setOtherInstalledModsMap(installedMap);
            return;
        }

        setLoading(true);

        const promises = [lastValueFrom(ipc.sendV2("bs-mods.get-available-mods", otherVersion))];
        if (otherVersion.path) {
            promises.push(lastValueFrom(ipc.sendV2("bs-mods.get-installed-mods", otherVersion)))
        }

        Promise.all(promises).then(([availableMods, installedMods]) => {
            if (availableMap) {
                availableMods.forEach(mod => availableMap.set(
                    mod.category,
                    [...(availableMap.get(mod.category) ?? []), mod]
                ));
            }
            if (installedMods) {
                installedMods.forEach(mod => installedMap.set(
                    mod.category,
                    [...(installedMap.get(mod.category) ?? []), mod]
                ));
            }
            setOtherAvailableModsMap(availableMap);
            setOtherInstalledModsMap(installedMap);
            setLoading(false);
        });
    }, [otherVersion]);


    return {
        mode, otherAvailableModsMap, otherInstalledModsMap,

        renderHeader: () => <div className="grid grid-cols-2 text-large mb-2">
            <div className="flex justify-center gap-x-2">
                <div>{version.BSVersion} - {version.name}</div>

                <BsmSelect
                    options={modeOptions}
                    defaultValue={Mode.All}
                    onChange={setMode}
                />
            </div>

            <BsmSelect
                className="mx-2"
                disabled={loading}
                options={versionOptions}
                defaultValue={null}
                onChange={setOtherVersion}
            />
        </div>

    };
}

function ModCompare({
    mod,
    installed,
    otherMod,
    otherInstalled,
    loading,
}: Readonly<{
    mod: Mod | null;
    installed: boolean;
    otherMod: Mod | null;
    otherInstalled: boolean;
    loading: boolean;
}>) {
    const name = mod?.name || otherMod?.name;

    const render = (renderMod: Mod | null, installed_: boolean, loading_: boolean = false) => {
        if (loading_) {
            return <div className="bg-black">TODO: Rainbow Lazy Loading</div>
        }

        if (!renderMod) {
            return <div className="bg-black py-1 px-2">{name}</div>
        }

        let modClass = "flex justify-between py-1 px-2 gap-x-2";
        if (installed_) {
            modClass += " bg-green-700";
        } else {
            modClass += " bg-red-700";
        }

        return <div key={renderMod._id} className={modClass}>
            <div className="text-ellipsis overflow-hidden">{name}</div>
            <div>{renderMod.version}</div>
        </div>
    }

    const renderSymbol = () => {
        let symbol = "";
        if (mod && !otherMod) {
            symbol = "-"; // Removed / Not Submitted Yet
        } else if (!mod && otherMod) {
            symbol = "+"; // Added
        } else if (mod.version === otherMod.version) {
            symbol = "="; // Equals
        } else if (safeLt(mod.version, otherMod.version)) {
            symbol = "^"; // Upgraded
        } else {
            symbol = "v"; // Downgraded
        }

        return <div className="text-center font-extrabold">{symbol}</div>
    }

    return <>
        {render(mod, installed)}
        {renderSymbol()}
        {render(otherMod, otherInstalled, loading)}
    </>
}

function ModCategory({
    mode,
    category,
    availableMods,
    installedMods,
    otherAvailableMods,
    otherInstalledMods,
    loading,
}: Readonly<{
    mode: Mode;
    category: string;
    availableMods: Mod[];
    installedMods: Mod[];
    otherAvailableMods: Mod[];
    otherInstalledMods: Mod[];
    loading: boolean;
}>) {
    let combinedMods: Mod[] = [];
    switch (mode) {
        case Mode.All:
            combinedMods = [...availableMods];
            if (otherAvailableMods.length === 0) {
                break;
            }

            availableMods.forEach(mod => {
                if (combinedMods.findIndex(cm => cm.name === mod.name) === -1) {
                    combinedMods.push(mod);
                }
            });
            combinedMods.sort((m1, m2) => m1.name.localeCompare(m2.name));
            break;

        case Mode.Installed:
            combinedMods = [...installedMods];
            break;

        case Mode.NotInstalled:
            combinedMods = availableMods.filter(
                mod => installedMods.findIndex(im => im.name === mod.name) === -1
            );
            break;

        default:
    }

    if (combinedMods.length === 0) {
        return <div />
    }

    return <div className="bg-gray-500 py-2 px-4 rounded-md mb-4">
        <h2 className="text-xl font-bold text-center mb-2">
            {category}
        </h2>

        <div className="grid" style={{
            gridTemplateColumns: "350px 25px 350px"
        }}>
            {combinedMods.map(mod =>
                <ModCompare
                    key={mod._id}
                    mod={availableMods.find(am => am.name === mod.name)}
                    installed={installedMods.findIndex(im => im.name === mod.name) > -1}
                    otherMod={otherAvailableMods.find(oam => oam.name === mod.name)}
                    otherInstalled={otherInstalledMods.findIndex(oim => oim.name === mod.name) > -1}
                    loading={loading}
                />
            )}
        </div>
    </div>
}

export const ModsVersionCompareModal: ModalComponent<void, Readonly<{
    version: BSVersion;
    availableModsMap: Map<string, Mod[]>;
    installedModsMap: Map<string, Mod[]>;
}>> = ({ options: { data: {
    version,
    availableModsMap,
    installedModsMap
} } }) => {
        const { text: t } = useTranslationV2();

        const [loading, setLoading] = useState(false);
        const {
            mode, otherAvailableModsMap, otherInstalledModsMap,
            renderHeader,
        } = useHeader({ version, loading, setLoading });

        let categories = mode === Mode.Installed
            ? [...installedModsMap.keys()]
            : [...availableModsMap.keys()];
        if (otherAvailableModsMap.size > 0) {
            categories = [...new Set([
                ...categories, ...otherAvailableModsMap.keys()
            ])];
            categories.sort((c1, c2) => c1.localeCompare(c2));
        }

        return (
            <div>
                <h1 className="tracking-wide w-full uppercase text-3xl text-center mb-4">
                    {t("modals.mods-version-compare.title")}
                </h1>

                {renderHeader()}

                <div className="h-[500px] overflow-y-auto">
                    {categories.map(category =>
                        <ModCategory
                            mode={mode}
                            category={category}
                            availableMods={availableModsMap.get(category) || []}
                            installedMods={installedModsMap.get(category) || []}
                            otherAvailableMods={otherAvailableModsMap.get(category) || []}
                            otherInstalledMods={otherInstalledModsMap.get(category) || []}
                            loading={loading}
                        />
                    )}
                </div>
            </div>
        )
    }
