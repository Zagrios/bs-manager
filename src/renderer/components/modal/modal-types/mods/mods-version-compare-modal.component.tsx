import { useEffect, useState } from "react";
import { logRenderError } from "renderer";
import { BsmBasicSpinner } from "renderer/components/shared/bsm-basic-spinner/bsm-basic-spinner.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { AddIcon } from "renderer/components/svgs/icons/add-icon.component";
import { DownIcon } from "renderer/components/svgs/icons/down-icon.component";
import { EqualIcon } from "renderer/components/svgs/icons/equals-icon.component";
import { RemoveIcon } from "renderer/components/svgs/icons/remove-icon.component";
import { UpIcon } from "renderer/components/svgs/icons/up-icon.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent } from "renderer/services/modale.service";
import { lastValueFrom } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { getVersionName } from "shared/helpers/bs-version.helpers";
import { getCompareModsMaps, ModCompareType, simplifyFullMod } from "shared/helpers/mods-version-compare.helpers";
import { safeLt } from "shared/helpers/semver.helpers";
import { BbmCategories, BbmFullMod, BbmModVersion } from "shared/models/mods/mod.interface";

enum Mode {
    All = "all",
    Installed = "installed",
    NotInstalled = "not-installed",
    Missing = "missing", // If mod is not found from the other version
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
    const [otherAvailableModsMap, setOtherAvailableModsMap] = useState(null as Map<BbmCategories, ModCompareType[]>);
    const [otherInstalledModsMap, setOtherInstalledModsMap] = useState(null as Map<BbmCategories, ModCompareType[]>);
    const [modsMapCache, setModsMapCache] = useState(new Map<BSVersion, Readonly<{
        availableModsMap: Map<BbmCategories, ModCompareType[]>;
        installedModsMap: Map<BbmCategories, ModCompareType[]>;
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
            setOtherAvailableModsMap(null);
            setOtherInstalledModsMap(null);
            return;
        }

        const cache = modsMapCache.get(otherVersion);
        if (cache) {
            setOtherAvailableModsMap(cache.availableModsMap);
            setOtherInstalledModsMap(cache.installedModsMap);
            return;
        }

        setLoading(true);

        const promises: Promise<BbmFullMod[] | BbmModVersion[]>[] = [
            lastValueFrom(ipc.sendV2("bs-mods.get-available-mods", otherVersion))
        ];
        if (otherVersion.path) {
            promises.push(lastValueFrom(ipc.sendV2("bs-mods.get-installed-mods", otherVersion)))
        }

        Promise.all(promises).then(([availableMods, installedMods]) => {
            const { availableModsMap, installedModsMap } = getCompareModsMaps(
                availableMods as BbmFullMod[],
                installedMods as BbmModVersion[] | undefined
            );

            // Manual in-memory caching
            const newCache = new Map(modsMapCache);
            newCache.set(otherVersion, {
                availableModsMap, installedModsMap,
            });
            setModsMapCache(newCache);

            setOtherAvailableModsMap(availableModsMap);
            setOtherInstalledModsMap(installedModsMap);
        }).catch(error => {
            logRenderError("Could not load mods for version comparison", error);
            setOtherAvailableModsMap(new Map());
            setOtherInstalledModsMap(new Map());
        }).finally(() => setLoading(false));
    }, [otherVersion]);

    return {
        mode,
        otherVersion, otherAvailableModsMap, otherInstalledModsMap,

        renderHeader: () => <div className="mb-4 overflow-hidden rounded-xl border border-black/10 bg-light-main-color-2 shadow-md shadow-black/20 dark:border-white/10 dark:bg-main-color-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 p-3">
                <div className="min-w-0 rounded-lg border border-black/10 bg-light-main-color-3 p-3 dark:border-white/10 dark:bg-main-color-1">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Beat Saber</div>
                    <div className="truncate text-2xl font-bold tracking-wide">{getVersionName(version)}</div>
                    <BsmSelect
                        className="mt-3 h-9 w-full rounded-md border border-black/10 bg-light-main-color-1 px-2 text-sm dark:border-white/10 dark:bg-main-color-2"
                        options={modeOptions}
                        selected={mode}
                        onChange={setMode}
                    />
                </div>

                <div className="flex items-center justify-center">
                    <div className="rounded-full border border-black/10 bg-light-main-color-3 px-3 py-1 text-sm font-black tracking-widest shadow-sm dark:border-white/10 dark:bg-main-color-1">
                        VS
                    </div>
                </div>

                <div className="min-w-0 rounded-lg border border-black/10 bg-light-main-color-3 p-3 dark:border-white/10 dark:bg-main-color-1">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Beat Saber</div>
                    <BsmSelect
                        className="mt-3 h-9 w-full rounded-md border border-black/10 bg-light-main-color-1 px-2 text-sm dark:border-white/10 dark:bg-main-color-2"
                        disabled={loading}
                        options={versionOptions}
                        selected={otherVersion}
                        onChange={setOtherVersion}
                    />
                </div>
            </div>
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
    mod: ModCompareType | null;
    otherMod: ModCompareType | null;
    installed: boolean;
    otherInstalled: boolean;
    // Check if the other version is installed locally
    otherInstalledLocal: boolean;
    loading: boolean;
}>) {
    const name = mod?.name || otherMod?.name;
    const cardClass = "flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 shadow-sm";
    const missingClass = `${cardClass} border-dashed border-black/10 bg-light-main-color-1 text-gray-500 dark:border-white/10 dark:bg-main-color-3 dark:text-gray-400`;

    const renderModContent = (modToRender: ModCompareType | null) => (
        <>
            <div className="min-w-0 truncate font-semibold">{name}</div>
            {modToRender ? (
                <div className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold tracking-wide dark:bg-white/10">
                    {modToRender.version}
                </div>
            ) : (
                <div className="shrink-0 text-xs italic opacity-60">—</div>
            )}
        </>
    );

    const renderMod = () => {
        if (!mod) {
            return <div className={missingClass}>{renderModContent(null)}</div>;
        }

        const modClass = installed ? (
            `${cardClass} border-green-500/40 bg-green-500/15 text-green-950 dark:bg-green-700/30 dark:text-green-100`
        ) : (
            `${cardClass} border-red-500/30 bg-red-500/15 text-red-950 dark:bg-red-700/25 dark:text-red-100`
        );

        return <div className={modClass}>{renderModContent(mod)}</div>;
    }

    const renderOtherMod = () => {
        if (loading) {
            return (
                <div className={`${missingClass} justify-center`}>
                    <BsmBasicSpinner className="h-4 w-4" thikness="2px" />
                </div>
            );
        }

        if (!otherMod) {
            return <div className={missingClass}>{renderModContent(null)}</div>;
        }

        let modClass = `${cardClass} border-blue-500/35 bg-blue-500/15 text-blue-950 dark:bg-blue-700/25 dark:text-blue-100`;
        if (otherInstalledLocal && otherInstalled) {
            modClass = `${cardClass} border-green-500/40 bg-green-500/15 text-green-950 dark:bg-green-700/30 dark:text-green-100`;
        } else if (otherInstalledLocal) {
            modClass = `${cardClass} border-red-500/30 bg-red-500/15 text-red-950 dark:bg-red-700/25 dark:text-red-100`;
        }

        return <div className={modClass}>{renderModContent(otherMod)}</div>;
    }

    const renderIcon = () => {
        if (loading) {
            return <div />
        }

        if (mod && !otherMod) {
            // Removed / Not Submitted Yet
            return <RemoveIcon className="h-5 w-5 text-red-500" />
        }

        if (!mod && otherMod) {
            // Added
            return <AddIcon className="h-5 w-5 text-blue-500" />
        }

        if (mod.version === otherMod.version) {
            // Equals
            return <EqualIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
        }

        if (safeLt(mod.version, otherMod.version)) {
            // Upgraded
            return <UpIcon className="h-5 w-5 text-green-500" />
        }

        // Downgraded
        return <DownIcon className="h-5 w-5 text-orange-400" />
    }

    return <>
        {renderMod()}
        <div className="flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-light-main-color-3 shadow-sm dark:border-white/10 dark:bg-main-color-1">
                {renderIcon()}
            </div>
        </div>
        {renderOtherMod()}
    </>
}

function ModCategory({
    mode,
    version,
    category,
    otherVersion,
    availableMods,
    installedMods,
    otherAvailableMods,
    otherInstalledMods,
    loading,
}: Readonly<{
    mode: Mode;
    version: BSVersion;
    category: string;
    otherVersion: BSVersion | null;
    availableMods: ModCompareType[];
    installedMods: ModCompareType[];
    otherAvailableMods: ModCompareType[];
    otherInstalledMods: ModCompareType[];
    loading: boolean;
}>) {
    const otherInstalledLocal = !!otherVersion?.path;

    let combinedMods: ModCompareType[] = [];
    switch (mode) {
        case Mode.All:
            combinedMods = [...availableMods];
            if (otherAvailableMods.length === 0) {
                break;
            }

            combinedMods.push(...otherAvailableMods.filter(
                mod => combinedMods.findIndex(cm => cm.id === mod.id) === -1
            ));
            combinedMods.sort((m1, m2) => m1.name.localeCompare(m2.name));
            break;

        case Mode.Installed:
            combinedMods = availableMods.filter(
                mod => installedMods.findIndex(im => im.id === mod.id) > -1
            );
            break;

        case Mode.NotInstalled:
            combinedMods = availableMods.filter(
                mod => installedMods.findIndex(im => im.id === mod.id) === -1
            );
            break;

        case Mode.Missing:
            if (otherAvailableMods.length === 0) {
                break;
            }
            combinedMods = otherAvailableMods.filter(
                mod => availableMods.findIndex(am => am.id === mod.id) === -1
            );
            break;

        default:
    }

    if (combinedMods.length === 0) {
        return <div />
    }

    return <div className="mb-4 overflow-hidden rounded-xl border border-black/10 bg-light-main-color-2 shadow-md shadow-black/20 dark:border-white/10 dark:bg-main-color-2">
        <div className="flex items-center justify-between bg-light-main-color-3 px-4 py-3 dark:bg-main-color-3">
            <h2 className="text-xl font-bold capitalize tracking-wide">
                {category}
            </h2>
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold dark:bg-white/10">
                {combinedMods.length}
            </span>
        </div>

        <div className="grid grid-cols-[minmax(290px,1fr)_40px_minmax(290px,1fr)] gap-x-2 gap-y-1 p-3">
            <div className="truncate px-3 pb-1 text-xs font-bold uppercase tracking-[0.18em] opacity-60">
                {getVersionName(version)}
            </div>
            <div />
            <div className="truncate px-3 pb-1 text-xs font-bold uppercase tracking-[0.18em] opacity-60">
                {otherVersion ? getVersionName(otherVersion) : ""}
            </div>
            {combinedMods.map(mod =>
                <ModCompare
                    key={mod.id}
                    mod={availableMods.find(am => am.id === mod.id)}
                    installed={installedMods.findIndex(im => im.id === mod.id) > -1}
                    otherMod={otherAvailableMods.find(oam => oam.id === mod.id)}
                    otherInstalled={otherInstalledMods.findIndex(oim => oim.id === mod.id) > -1}
                    otherInstalledLocal={otherInstalledLocal}
                    loading={loading}
                />
            )}
        </div>
    </div>
}

export const ModsVersionCompareModal: ModalComponent<void, Readonly<{
    version: BSVersion;
    availableModsMap: Map<BbmCategories, BbmFullMod[]>;
    installedModsMap: Map<BbmCategories, BbmFullMod[]>;
}>> = ({ options: { data: {
    version,
    availableModsMap,
    installedModsMap
} } }) => {
        const { text: t } = useTranslationV2();

        const simpleAvailableModsMap = useConstant(() => {
            const map = new Map<BbmCategories, ModCompareType[]>();
            availableModsMap.forEach((mods, category) =>
                map.set(category, mods.map(simplifyFullMod))
            );
            return map;
        });
        const simpleInstalledModsMap = useConstant(() => {
            const map = new Map<BbmCategories, ModCompareType[]>();
            installedModsMap.forEach((mods, category) =>
                map.set(category, mods.map(simplifyFullMod))
            );
            return map;
        });

        const [loading, setLoading] = useState(false);
        const {
            mode,
            otherVersion, otherAvailableModsMap, otherInstalledModsMap,
            renderHeader,
        } = useHeader({ version, loading, setLoading });

        return (
            <div className="w-[860px] max-w-[calc(100vw-3rem)]">
                <h1 className="mb-3 w-full text-center text-3xl uppercase tracking-wide">
                    {t("modals.mods-version-compare.title")}
                </h1>

                {renderHeader()}

                <div className="h-[500px] overflow-y-auto pr-1 scrollbar-default">
                    {Object.values(BbmCategories).map(category =>
                        <ModCategory
                            key={category}
                            mode={mode}
                            version={version}
                            category={category}
                            otherVersion={otherVersion}
                            availableMods={simpleAvailableModsMap.get(category) || []}
                            installedMods={simpleInstalledModsMap.get(category) || []}
                            otherAvailableMods={otherAvailableModsMap?.get(category) || []}
                            otherInstalledMods={otherInstalledModsMap?.get(category) || []}
                            loading={loading}
                        />
                    )}
                </div>
            </div>
        )
    }
