import { Fragment, useEffect, useState } from "react";
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
import { getCompareModsMaps, ModCompareMaps, ModCompareType, simplifyFullMod } from "shared/helpers/mods-version-compare.helpers";
import { safeLt } from "shared/helpers/semver.helpers";
import { BbmCategories, BbmFullMod, BbmModVersion } from "shared/models/mods/mod.interface";

enum Mode {
    All = "all",
    Installed = "installed",
    NotInstalled = "not-installed",
    Missing = "missing", // If mod is not found from one compared version
}

type ComparedVersion = Readonly<{
    version: BSVersion;
    availableModsMap: Map<BbmCategories, ModCompareType[]>;
    installedModsMap: Map<BbmCategories, ModCompareType[]>;
    loading: boolean;
}>;

const EMPTY_MODS_MAP = new Map<BbmCategories, ModCompareType[]>();

function getVersionKey(version: BSVersion): string {
    return [
        version.BSVersion,
        version.name ?? "",
        version.path ?? "",
        version.metadata?.id ?? "",
        version.steam ? "steam" : "",
        version.oculus ? "oculus" : "",
    ].join("|");
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
    const { text: t } = useTranslationV2();

    const [mode, setMode] = useState(Mode.All);
    const [selectedVersions, setSelectedVersions] = useState([] as BSVersion[]);
    const [selectedVersionMods, setSelectedVersionMods] = useState(new Map<string, ModCompareMaps>());
    const [modsMapCache, setModsMapCache] = useState(new Map<string, ModCompareMaps>());
    const [loadingVersionKeys, setLoadingVersionKeys] = useState(new Set<string>());

    const modeOptions: BsmSelectOption<Mode>[] = useConstant(() =>
        Object.values(Mode).map(val => ({
            text: `modals.mods-version-compare.mod-types.${val}`,
            value: val,
        }))
    );
    const [versionOptions, setVersionOptions] = useState([] as BsmSelectOption<BSVersion>[]);

    useEffect(() => {
        setLoading(loadingVersionKeys.size > 0);
    }, [loadingVersionKeys, setLoading]);

    useEffect(() => {
        Promise.all([
            lastValueFrom(ipc.sendV2("bs-version.get-version-dict")),
            lastValueFrom(ipc.sendV2("bs-version.installed-versions")),
        ])
            .then(([availableVersions, installedVersions]) => {
                const installedVersionNumbers = new Set(installedVersions.map(v => v.BSVersion));
                const options = [
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
                        .filter(v => v.BSVersion !== version.BSVersion && !installedVersionNumbers.has(v.BSVersion))
                        .map(v => ({ text: v.BSVersion, value: v }))
                        .sort((v1, v2) => safeLt(v1.text, v2.text) ? 1 : -1)
                ];
                setVersionOptions(options);
            })
            .catch(error => logRenderError("Could not load versions dict", error));
    }, []);

    const loadVersionMods = (selectedVersion: BSVersion) => {
        const versionKey = getVersionKey(selectedVersion);
        const cached = modsMapCache.get(versionKey);
        if (cached) {
            setSelectedVersionMods(current => {
                const newSelectedVersionMods = new Map(current);
                newSelectedVersionMods.set(versionKey, cached);
                return newSelectedVersionMods;
            });
            return;
        }

        setLoadingVersionKeys(current => {
            const newLoadingVersionKeys = new Set(current);
            newLoadingVersionKeys.add(versionKey);
            return newLoadingVersionKeys;
        });

        const promises: Promise<BbmFullMod[] | BbmModVersion[]>[] = [
            lastValueFrom(ipc.sendV2("bs-mods.get-available-mods", selectedVersion))
        ];
        if (selectedVersion.path) {
            promises.push(lastValueFrom(ipc.sendV2("bs-mods.get-installed-mods", selectedVersion)))
        }

        Promise.all(promises).then(([availableMods, installedMods]) => {
            const maps = getCompareModsMaps(
                availableMods as BbmFullMod[],
                installedMods as BbmModVersion[] | undefined
            );

            setModsMapCache(current => {
                const newCache = new Map(current);
                newCache.set(versionKey, maps);
                return newCache;
            });
            setSelectedVersionMods(current => {
                const newSelectedVersionMods = new Map(current);
                newSelectedVersionMods.set(versionKey, maps);
                return newSelectedVersionMods;
            });
        }).catch(error => {
            logRenderError("Could not load mods for version comparison", error);
            setSelectedVersionMods(current => {
                const newSelectedVersionMods = new Map(current);
                newSelectedVersionMods.set(versionKey, {
                    availableModsMap: new Map(),
                    installedModsMap: new Map(),
                });
                return newSelectedVersionMods;
            });
        }).finally(() => {
            setLoadingVersionKeys(current => {
                const newLoadingVersionKeys = new Set(current);
                newLoadingVersionKeys.delete(versionKey);
                return newLoadingVersionKeys;
            });
        });
    };

    const addSelectedVersion = (selectedVersion: BSVersion | null) => {
        if (!selectedVersion) {
            return;
        }

        const versionKey = getVersionKey(selectedVersion);
        if (selectedVersions.find(v => getVersionKey(v) === versionKey)) {
            return;
        }

        setSelectedVersions(current => [...current, selectedVersion]);
        loadVersionMods(selectedVersion);
    };

    const removeSelectedVersion = (selectedVersion: BSVersion) => {
        const versionKey = getVersionKey(selectedVersion);
        setSelectedVersions(current => current.filter(v => getVersionKey(v) !== versionKey));
        setSelectedVersionMods(current => {
            const newSelectedVersionMods = new Map(current);
            newSelectedVersionMods.delete(versionKey);
            return newSelectedVersionMods;
        });
    };

    return {
        mode,
        selectedVersions,
        selectedVersionMods,
        loadingVersionKeys,

        renderHeader: () => {
            const selectedVersionKeys = new Set(selectedVersions.map(getVersionKey));
            const selectableVersionOptions: BsmSelectOption<BSVersion | null>[] = [
                {
                    text: "modals.mods-version-compare.select-version",
                    value: null
                },
                ...versionOptions.filter(option => !selectedVersionKeys.has(getVersionKey(option.value)))
            ];

            return <div className="mb-3 overflow-hidden rounded-xl border border-black/10 bg-light-main-color-2 shadow-md shadow-black/20 dark:border-white/10 dark:bg-main-color-2">
                <div className="grid grid-cols-[minmax(230px,0.75fr)_minmax(0,1.25fr)] items-stretch gap-2 p-2">
                    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-black/10 bg-light-main-color-3 px-3 py-2 dark:border-white/10 dark:bg-main-color-1">
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Beat Saber</div>
                            <div className="truncate text-xl font-bold tracking-wide">{getVersionName(version)}</div>
                        </div>
                        <BsmSelect
                            className="h-8 w-36 shrink-0 rounded-md border border-black/10 bg-light-main-color-1 px-2 text-sm dark:border-white/10 dark:bg-main-color-2"
                            options={modeOptions}
                            selected={mode}
                            onChange={setMode}
                        />
                    </div>

                    <div className="min-w-0 rounded-lg border border-black/10 bg-light-main-color-3 px-3 py-2 dark:border-white/10 dark:bg-main-color-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <div className="shrink-0 rounded-full border border-black/10 bg-light-main-color-2 px-3 py-1 text-xs font-black tracking-widest shadow-sm dark:border-white/10 dark:bg-main-color-2">
                                VS
                            </div>
                            <BsmSelect
                                key={selectedVersions.map(getVersionKey).join("|")}
                                className="h-8 min-w-[180px] flex-1 rounded-md border border-black/10 bg-light-main-color-1 px-2 text-sm dark:border-white/10 dark:bg-main-color-2"
                                disabled={loading || selectableVersionOptions.length <= 1}
                                options={selectableVersionOptions}
                                selected={null}
                                onChange={addSelectedVersion}
                            />
                        </div>

                        {selectedVersions.length > 0 ? (
                            <div className="mt-2 flex max-h-20 flex-wrap gap-2 overflow-y-auto pr-1 scrollbar-default">
                                {selectedVersions.map((selectedVersion, index) => {
                                    const versionKey = getVersionKey(selectedVersion);
                                    return <div key={versionKey} className="flex max-w-full items-center gap-2 rounded-full border border-black/10 bg-light-main-color-2 px-2 py-1 text-sm font-semibold shadow-sm dark:border-white/10 dark:bg-main-color-2">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/10 text-xs font-black dark:bg-white/10">
                                            {index + 1}
                                        </span>
                                        <span className="max-w-[220px] truncate">
                                            {getVersionName(selectedVersion)}
                                        </span>
                                        {loadingVersionKeys.has(versionKey) && <BsmBasicSpinner className="h-3 w-3 shrink-0" thikness="2px" />}
                                        <button
                                            type="button"
                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/10 transition-colors hover:bg-red-500/30 dark:bg-white/10 dark:hover:bg-red-500/30"
                                            aria-label={`Remove ${getVersionName(selectedVersion)}`}
                                            onClick={() => removeSelectedVersion(selectedVersion)}
                                        >
                                            <RemoveIcon className="h-3 w-3" />
                                        </button>
                                    </div>
                                })}
                            </div>
                        ) : (
                            <div className="mt-2 rounded-md border border-dashed border-black/10 px-3 py-2 text-xs font-semibold opacity-60 dark:border-white/10">
                                {t("modals.mods-version-compare.select-version")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        }
    };
}

function ModCompareCell({
    mod,
    fallbackName,
    installed,
    installedLocal,
    loading,
}: Readonly<{
    mod: ModCompareType | null;
    fallbackName: string;
    installed: boolean;
    installedLocal: boolean;
    loading: boolean;
}>) {
    const name = mod?.name || fallbackName;
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

    if (loading) {
        return (
            <div className={`${missingClass} justify-center`}>
                <BsmBasicSpinner className="h-4 w-4" thikness="2px" />
            </div>
        );
    }

    if (!mod) {
        return <div className={missingClass}>{renderModContent(null)}</div>;
    }

    let modClass = `${cardClass} border-blue-500/35 bg-blue-500/15 text-blue-950 dark:bg-blue-700/25 dark:text-blue-100`;
    if (installedLocal && installed) {
        modClass = `${cardClass} border-green-500/40 bg-green-500/15 text-green-950 dark:bg-green-700/30 dark:text-green-100`;
    } else if (installedLocal) {
        modClass = `${cardClass} border-red-500/30 bg-red-500/15 text-red-950 dark:bg-red-700/25 dark:text-red-100`;
    }

    return <div className={modClass}>{renderModContent(mod)}</div>;
}

function ComparisonIcon({
    leftMod,
    rightMod,
    loading,
}: Readonly<{
    leftMod: ModCompareType | null;
    rightMod: ModCompareType | null;
    loading: boolean;
}>) {
    const renderIcon = () => {
        if (loading || (!leftMod && !rightMod)) {
            return <div />;
        }

        if (leftMod && !rightMod) {
            // Removed / Not Submitted Yet
            return <RemoveIcon className="h-5 w-5 text-red-500" />
        }

        if (!leftMod && rightMod) {
            // Added
            return <AddIcon className="h-5 w-5 text-blue-500" />
        }

        if (leftMod.version === rightMod.version) {
            // Equals
            return <EqualIcon className="h-5 w-5 text-gray-500 dark:text-gray-300" />
        }

        if (safeLt(leftMod.version, rightMod.version)) {
            // Upgraded
            return <UpIcon className="h-5 w-5 text-green-500" />
        }

        // Downgraded
        return <DownIcon className="h-5 w-5 text-orange-400" />
    }

    return <div className="flex items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-light-main-color-3 shadow-sm dark:border-white/10 dark:bg-main-color-1">
            {renderIcon()}
        </div>
    </div>
}

function ModCategory({
    mode,
    category,
    comparedVersions,
}: Readonly<{
    mode: Mode;
    category: BbmCategories;
    comparedVersions: ComparedVersion[];
}>) {
    const availableModsByVersion = comparedVersions.map(comparedVersion => comparedVersion.availableModsMap.get(category) || []);
    const installedModsByVersion = comparedVersions.map(comparedVersion => comparedVersion.installedModsMap.get(category) || []);

    const addUniqueMods = (combinedMods: ModCompareType[], mods: ModCompareType[]) => {
        mods.forEach(mod => {
            if (combinedMods.findIndex(combinedMod => combinedMod.id === mod.id) === -1) {
                combinedMods.push(mod);
            }
        });
    };

    let combinedMods: ModCompareType[] = [];
    switch (mode) {
        case Mode.All:
            availableModsByVersion.forEach(mods => addUniqueMods(combinedMods, mods));
            combinedMods.sort((m1, m2) => m1.name.localeCompare(m2.name));
            break;

        case Mode.Installed:
            combinedMods = availableModsByVersion[0].filter(
                mod => installedModsByVersion[0].findIndex(im => im.id === mod.id) > -1
            );
            break;

        case Mode.NotInstalled:
            combinedMods = availableModsByVersion[0].filter(
                mod => installedModsByVersion[0].findIndex(im => im.id === mod.id) === -1
            );
            break;

        case Mode.Missing:
            availableModsByVersion.forEach(mods => addUniqueMods(combinedMods, mods));
            combinedMods = combinedMods.filter(mod => availableModsByVersion.some(mods => mods.findIndex(availableMod => availableMod.id === mod.id) === -1));
            combinedMods.sort((m1, m2) => m1.name.localeCompare(m2.name));
            break;

        default:
    }

    if (combinedMods.length === 0) {
        return <div />
    }

    const modColumnMinWidth = comparedVersions.length >= 5 ? 160 : 240;
    const comparisonIconColumnWidth = comparedVersions.length >= 5 ? 32 : 40;
    const gridTemplateColumns = comparedVersions
        .map((_, index) => `${index > 0 ? `${comparisonIconColumnWidth}px ` : ""}minmax(${modColumnMinWidth}px, 1fr)`)
        .join(" ");
    const minGridWidth = comparedVersions.length > 2
        ? `${comparedVersions.length * modColumnMinWidth + (comparedVersions.length - 1) * comparisonIconColumnWidth}px`
        : "100%";

    return <div className="mb-4 overflow-hidden rounded-xl border border-black/10 bg-light-main-color-2 shadow-md shadow-black/20 dark:border-white/10 dark:bg-main-color-2">
        <div className="flex items-center justify-between bg-light-main-color-3 px-4 py-3 dark:bg-main-color-3">
            <h2 className="text-xl font-bold capitalize tracking-wide">
                {category}
            </h2>
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold dark:bg-white/10">
                {combinedMods.length}
            </span>
        </div>

        <div className="overflow-x-auto scrollbar-default">
            <div className="grid gap-x-2 gap-y-1 p-3" style={{ gridTemplateColumns, minWidth: minGridWidth }}>
                {comparedVersions.map((comparedVersion, index) =>
                    <Fragment key={getVersionKey(comparedVersion.version)}>
                        {index > 0 && <div />}
                        <div className="truncate px-3 pb-1 text-xs font-bold uppercase tracking-[0.18em] opacity-60">
                            {getVersionName(comparedVersion.version)}
                        </div>
                    </Fragment>
                )}

                {combinedMods.map(mod =>
                    <Fragment key={mod.id}>
                        {comparedVersions.map((comparedVersion, index) => {
                            const currentMod = availableModsByVersion[index].find(am => am.id === mod.id) || null;
                            const previousMod = index > 0
                                ? availableModsByVersion[index - 1].find(am => am.id === mod.id) || null
                                : null;
                            const installed = installedModsByVersion[index].findIndex(im => im.id === mod.id) > -1;
                            const installedLocal = index === 0 || !!comparedVersion.version.path;
                            const comparisonLoading = index > 0 && (comparedVersions[index - 1].loading || comparedVersion.loading);

                            return <Fragment key={getVersionKey(comparedVersion.version)}>
                                {index > 0 && <ComparisonIcon leftMod={previousMod} rightMod={currentMod} loading={comparisonLoading} />}
                                <ModCompareCell
                                    mod={currentMod}
                                    fallbackName={mod.name}
                                    installed={installed}
                                    installedLocal={installedLocal}
                                    loading={comparedVersion.loading}
                                />
                            </Fragment>
                        })}
                    </Fragment>
                )}
            </div>
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
            selectedVersions,
            selectedVersionMods,
            loadingVersionKeys,
            renderHeader,
        } = useHeader({ version, loading, setLoading });
        const comparedVersions: ComparedVersion[] = [
            {
                version,
                availableModsMap: simpleAvailableModsMap,
                installedModsMap: simpleInstalledModsMap,
                loading: false,
            },
            ...selectedVersions.map(selectedVersion => {
                const versionKey = getVersionKey(selectedVersion);
                const modsMaps = selectedVersionMods.get(versionKey);
                return {
                    version: selectedVersion,
                    availableModsMap: modsMaps?.availableModsMap ?? EMPTY_MODS_MAP,
                    installedModsMap: modsMaps?.installedModsMap ?? EMPTY_MODS_MAP,
                    loading: loadingVersionKeys.has(versionKey),
                };
            }),
        ];

        return (
            <div className="flex max-h-[calc(100vh-5rem)] w-[1180px] max-w-[calc(100vw-3rem)] flex-col">
                <h1 className="mb-3 w-full text-center text-3xl uppercase tracking-wide">
                    {t("modals.mods-version-compare.title")}
                </h1>

                <div className="shrink-0">
                    {renderHeader()}
                </div>

                <div className="min-h-0 max-h-[500px] flex-1 overflow-y-auto pr-1 scrollbar-default">
                    {Object.values(BbmCategories).map(category =>
                        <ModCategory
                            key={category}
                            mode={mode}
                            category={category}
                            comparedVersions={comparedVersions}
                        />
                    )}
                </div>
            </div>
        )
    }
