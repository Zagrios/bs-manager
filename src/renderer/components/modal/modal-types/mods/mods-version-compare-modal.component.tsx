import { useEffect, useState } from "react";
import { logRenderError } from "renderer";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { AddIcon } from "renderer/components/svgs/icons/add-icon.component";
import { DownIcon } from "renderer/components/svgs/icons/down-icon.component";
import { EqualIcon } from "renderer/components/svgs/icons/equals-icon.component";
import { RemoveIcon } from "renderer/components/svgs/icons/remove-icon.component";
import { UpIcon } from "renderer/components/svgs/icons/up-icon.component";
import { getVersionName } from "renderer/helpers/bs-version.helpers";
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
    const [modsMapCache, setModsMapCache] = useState(new Map<BSVersion, Readonly<{
        availableModsMap: Map<string, Mod[]>;
        installedModsMap: Map<string, Mod[]>;
    }>>());

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
                        .map(v => ({
                            text: getVersionName(v),
                            value: v
                        })),
                    ...availableVersions
                        .filter(v => v.BSVersion !== version.BSVersion)
                        .map(v => ({ text: v.BSVersion, value: v }))
                        .sort((v1, v2) => safeLt(v1.text, v2.text) ? 1 : -1)
                ]);
            })
            .catch(error => logRenderError("Could not load versions dict", error));
    }, []);

    useEffect(() => {
        if (!otherVersion) {
            const empty = new Map<string, Mod[]>();
            setOtherAvailableModsMap(empty);
            setOtherInstalledModsMap(empty);
            return;
        }

        const cached = modsMapCache.get(otherVersion);
        if (cached) {
            setOtherAvailableModsMap(cached.availableModsMap);
            setOtherInstalledModsMap(cached.installedModsMap);
            return;
        }

        setLoading(true);

        const promises = [lastValueFrom(ipc.sendV2("bs-mods.get-available-mods", otherVersion))];
        if (otherVersion.path) {
            promises.push(lastValueFrom(ipc.sendV2("bs-mods.get-installed-mods", otherVersion)))
        }

        Promise.all(promises).then(([availableMods, installedMods]) => {
            const availableModsMap = new Map<string, Mod[]>();
            const installedModsMap = new Map<string, Mod[]>();

            availableMods.forEach(mod => availableModsMap.set(
                mod.category,
                [...(availableModsMap.get(mod.category) ?? []), mod]
            ));
            if (installedMods) {
                installedMods.forEach(mod => installedModsMap.set(
                    mod.category,
                    [...(installedModsMap.get(mod.category) ?? []), mod]
                ));
            }

            // Manual in-memory caching
            const newCache = new Map(modsMapCache);
            newCache.set(otherVersion, {
                availableModsMap, installedModsMap,
            });
            setModsMapCache(newCache);

            setOtherAvailableModsMap(availableModsMap);
            setOtherInstalledModsMap(installedModsMap);
            setLoading(false);
        });
    }, [otherVersion]);


    return {
        mode,
        otherVersion, otherAvailableModsMap, otherInstalledModsMap,

        renderHeader: () => <div className="grid grid-cols-2 text-large mb-2">
            <div className="flex justify-center gap-x-2">
                <div>{getVersionName(version)}</div>

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
    otherInstalledLocal,
    loading,
}: Readonly<{
    mod: Mod | null;
    installed: boolean;
    otherMod: Mod | null;
    otherInstalled: boolean;
    // Check if the other version is installed locally
    otherInstalledLocal: boolean;
    loading: boolean;
}>) {
    const name = mod?.name || otherMod?.name;

    const renderMod = () => {
        if (!mod) {
            return <div className="bg-black py-1 px-2">{name}</div>
        }

        let modClass = "flex justify-between py-1 px-2 gap-x-2";
        if (installed) {
            modClass += " bg-green-700";
        } else {
            modClass += " bg-red-700";
        }

        return <div className={modClass}>
            <div className="text-ellipsis overflow-hidden">{name}</div>
            <div>{mod.version}</div>
        </div>
    }

    const renderOtherMod = () => {
        if (loading) {
            return <div className="bg-black">TODO: Rainbow Lazy Loading</div>
        }

        if (!otherMod) {
            return <div className="bg-black py-1 px-2">{name}</div>
        }

        let modClass = "flex justify-between py-1 px-2 gap-x-2";
        if (!otherInstalledLocal) {
            modClass += " bg-blue-700"; // Change, just for visual prototyping
        } else if (otherInstalled) {
            modClass += " bg-green-700";
        } else {
            modClass += " bg-red-700";
        }

        return <div className={modClass}>
            <div className="text-ellipsis overflow-hidden">{name}</div>
            <div>{otherMod.version}</div>
        </div>
    }

    const renderIcon = () => {
        if (loading) {
            return <div />
        }

        if (mod && !otherMod) {
            // Removed / Not Submitted Yet
            return <RemoveIcon className="text-center w-6 h-6" />
        }

        if (!mod && otherMod) {
            // Added
            return <AddIcon className="text-center w-6 h-6" />
        }

        if (mod.version === otherMod.version) {
            // Equals
            return <EqualIcon className="text-center w-6 h-6" />
        }

        if (safeLt(mod.version, otherMod.version)) {
            // Upgraded
            return <UpIcon className="text-center w-6 h-6" />
        }

        // Downgraded
        return <DownIcon className="text-center w-6 h-6" />
    }

    return <>
        {renderMod()}
        {renderIcon()}
        {renderOtherMod()}
    </>
}

function ModCategory({
    mode,
    category,
    otherVersion,
    availableMods,
    installedMods,
    otherAvailableMods,
    otherInstalledMods,
    loading,
}: Readonly<{
    mode: Mode;
    category: string;
    otherVersion: BSVersion;
    availableMods: Mod[];
    installedMods: Mod[];
    otherAvailableMods: Mod[];
    otherInstalledMods: Mod[];
    loading: boolean;
}>) {
    const otherInstalledLocal = !!otherVersion?.path;

    let combinedMods: Mod[] = [];
    switch (mode) {
        case Mode.All:
            combinedMods = [...availableMods];
            if (otherAvailableMods.length === 0) {
                break;
            }

            combinedMods.push(...otherAvailableMods.filter(
                mod => combinedMods.findIndex(cm => cm.name === mod.name) === -1
            ));
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
            gridTemplateColumns: "350px 24px 350px"
        }}>
            {combinedMods.map(mod =>
                <ModCompare
                    key={mod.name}
                    mod={availableMods.find(am => am.name === mod.name)}
                    installed={installedMods.findIndex(im => im.name === mod.name) > -1}
                    otherMod={otherAvailableMods.find(oam => oam.name === mod.name)}
                    otherInstalled={otherInstalledMods.findIndex(oim => oim.name === mod.name) > -1}
                    otherInstalledLocal={otherInstalledLocal}
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
            mode,
            otherVersion, otherAvailableModsMap, otherInstalledModsMap,
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
                            key={category}
                            mode={mode}
                            category={category}
                            otherVersion={otherVersion}
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
