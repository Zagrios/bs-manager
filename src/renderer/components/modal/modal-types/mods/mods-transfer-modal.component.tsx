import Tippy from "@tippyjs/react";
import { useEffect, useState } from "react";
import { logRenderError } from "renderer";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { TransferIcon } from "renderer/components/svgs/icons/transfer-icon.component";
import { getVersionName } from "renderer/helpers/bs-version.helpers";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { lastValueFrom } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { safeLt } from "shared/helpers/semver.helpers";
import { Mod } from "shared/models/mods";


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

    const [otherVersion, setOtherVersion] = useState(null as BSVersion | null);
    const [otherAvailableModsMap, setOtherAvailableModsMap] = useState(new Map<string, Mod[]>());
    const [otherInstalledModsMap, setOtherInstalledModsMap] = useState(new Map<string, Mod[]>());
    const [modsMapCache, setModsMapCache] = useState(new Map<BSVersion, Readonly<{
        availableModsMap: Map<string, Mod[]>;
        installedModsMap: Map<string, Mod[]>;
    }>>());

    const [versionOptions, setVersionOptions] = useState(
        [] as BsmSelectOption<BSVersion | null>[]
    );

    useEffect(() => {
        lastValueFrom(ipc.sendV2("bs-version.installed-versions"))
            .then((installedVersions) => {
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
        otherVersion, otherAvailableModsMap, otherInstalledModsMap,

        renderHeader: () => <div className="grid grid-cols-2 text-large mb-2">
            <div>{getVersionName(version)}</div>

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

function ModTransfer({
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
        if (otherInstalled) {
            modClass += " bg-green-700";
        } else {
            modClass += " bg-red-700";
        }

        return <div className={modClass}>
            <div className="text-ellipsis overflow-hidden">{name}</div>
            <div>{otherMod.version}</div>
        </div>
    }

    return <>
        {renderMod()}
        <TransferIcon className="text-center w6 h-6" />
        {renderOtherMod()}
    </>;
}

function ModCategory({
    category,
    availableMods,
    installedMods,
    otherAvailableMods,
    otherInstalledMods,
    loading,
}: Readonly<{
    category: string;
    availableMods: Mod[];
    installedMods: Mod[];
    otherAvailableMods: Mod[];
    otherInstalledMods: Mod[];
    loading: boolean;
}>) {
    const combinedMods: Mod[] = [...installedMods];
    if (otherInstalledMods.length > 0) {
        combinedMods.push(...otherInstalledMods.filter(
            otherMod => installedMods.findIndex(mod => mod.name === otherMod.name) === -1
        ));
        combinedMods.sort((m1, m2) => m1.name.localeCompare(m2.name));
    }

    return <div className="bg-gray-500 py-2 px-4 rounded-md mb-4">
        <h2 className="text-xl font-bold text-center mb-2">
            {category}
        </h2>

        <div className="grid" style={{
            gridTemplateColumns: "350px 24px 350px"
        }}>
            {combinedMods.map(mod =>
                <ModTransfer
                    key={mod.name}
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

function ButtonBar({
    version,
    otherVersion,
    isMissingMods,
    onTransferClick,
    onExactTransferClick,
    onCancelClick,
}: Readonly<{
    version: BSVersion;
    otherVersion: BSVersion | null;
    isMissingMods: boolean;
    onTransferClick: () => void;
    onExactTransferClick: () => void;
    onCancelClick: () => void;
}>) {
    const { text: t } = useTranslationV2();

    const versionName = getVersionName(version);

    return <div>
        {otherVersion && isMissingMods &&
            <div className="italic">
                {t("modals.mods-transfer.descriptions.missing-mods", {
                    versionName: getVersionName(otherVersion)
                })}
            </div>
        }

        <div className="grid grid-flow-col grid-cols-3 gap-4 pt-3">
            <BsmButton
                typeColor="cancel"
                className="rounded-md text-center transition-all"
                onClick={onCancelClick}
                withBar={false}
                text="misc.cancel"
            />
            <Tippy content={t("modals.mods-transfer.descriptions.transfer", { versionName })}>
                <BsmButton
                    typeColor="primary"
                    className="rounded-md text-center transition-all"
                    onClick={onTransferClick}
                    withBar={false}
                    disabled={!otherVersion}
                    text="modals.mods-transfer.buttons.transfer"
                />
            </Tippy>
            <Tippy content={t("modals.mods-transfer.descriptions.exact-transfer", { versionName })}>
                <BsmButton
                    typeColor="primary"
                    className="rounded-md text-center transition-all"
                    onClick={onExactTransferClick}
                    withBar={false}
                    disabled={!otherVersion}
                    text="modals.mods-transfer.buttons.exact-transfer"
                />
            </Tippy>
        </div>
    </div>;
}

export const ModsTransferModal: ModalComponent<{
    toVersion: BSVersion;
    addMods: Mod[];
    removeMods: Mod[];
}, Readonly<{
    version: BSVersion
    availableModsMap: Map<string, Mod[]>;
    installedModsMap: Map<string, Mod[]>;
}>> = ({ resolver, options: { data: {
    version,
    availableModsMap,
    installedModsMap,
} } }) => {
        const { text: t } = useTranslationV2();

        const [loading, setLoading] = useState(false);
        const {
            otherVersion, otherAvailableModsMap, otherInstalledModsMap,
            renderHeader
        } = useHeader({ version, loading, setLoading });

        let categories = [...installedModsMap.keys()];
        if (otherInstalledModsMap.size > 0) {
            categories = [...new Set([
                ...categories, ...otherInstalledModsMap.keys()
            ])];
            categories.sort((c1, c2) => c1.localeCompare(c2));
        }

        const handleTransfer = (exact: boolean) => {
            const installedMods = [...installedModsMap.values()].flat();
            const otherAvailableMods = [...otherAvailableModsMap.values()].flat();
            const otherInstalledMods = [...otherInstalledModsMap.values()].flat();
            const data = {
                toVersion: otherVersion,
                addMods: [...installedModsMap.values()]
                    .flat()
                    .filter(mod =>
                        // If the mods are available to the other version
                        otherAvailableMods.findIndex(
                            availMod => availMod.name === mod.name
                        ) > -1
                        // If the mods are already installed to the other version
                        && otherInstalledMods.findIndex(
                            installMod => installMod.name === mod.name
                        ) === -1
                    ),
                removeMods: [] as Mod[],
            };
            if (exact) {
                data.removeMods = otherInstalledMods.filter(otherMod =>
                    installedMods.findIndex(mod => mod.name === otherMod.name) === -1
                );
            }

            resolver({ exitCode: ModalExitCode.COMPLETED, data });
        };

        // Check if the current mods does not exist with the
        //   available mods from the target version
        const isMissingMods = () => {
            if (loading || otherAvailableModsMap.size === 0) {
                return false;
            }

            for (const [category, mods] of availableModsMap.entries()) {
                const otherMods = otherAvailableModsMap.get(category);
                if (!mods.every(
                    mod => otherMods.findIndex(om => om.name === mod.name) === -1
                )) {
                    return true;
                }
            }
            return false;
        };

        return <div>
            <h1 className="tracking-wide w-full uppercase text-3xl text-center mb-4">
                {t("modals.mods-transfer.title")}
            </h1>

            {renderHeader()}

            <div className="h-[500px] overflow-y-auto">
                {categories.map(category =>
                    <ModCategory
                        key={category}
                        category={category}
                        availableMods={availableModsMap.get(category) || []}
                        installedMods={installedModsMap.get(category) || []}
                        otherAvailableMods={otherAvailableModsMap.get(category) || []}
                        otherInstalledMods={otherInstalledModsMap.get(category) || []}
                        loading={loading}
                    />
                )}
            </div>

            <ButtonBar
                version={version}
                otherVersion={otherVersion}
                isMissingMods={isMissingMods()}
                onTransferClick={() => handleTransfer(false)}
                onExactTransferClick={() => handleTransfer(true)}
                onCancelClick={() => resolver({ exitCode: ModalExitCode.CANCELED })}
            />
        </div>
    }
