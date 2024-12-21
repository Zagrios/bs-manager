import { useEffect, useMemo, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { BSLauncherService } from "renderer/services/bs-launcher.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { BSVersion } from "shared/bs-version.interface";
import { LaunchModToogle } from "./launch-mod-toogle.component";
import BSLogo from "../../../../../../assets/images/apngs/bs-logo.png";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useService } from "renderer/hooks/use-service.hook";
import { BsStore } from "shared/models/bs-store.enum";
import { lastValueFrom } from "rxjs";
import { BsDownloaderService } from "renderer/services/bs-version-download/bs-downloader.service";
import equal from "fast-deep-equal";
import { GlowEffect } from "renderer/components/shared/glow-effect.component";
import { cn } from "renderer/helpers/css-class.helpers";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { safeLt } from "shared/helpers/semver.helpers";
import { WarningIcon } from "renderer/components/svgs/icons/warning-icon.component";
import Tippy from "@tippyjs/react";
import { LaunchModItemProps, LaunchOptionsPanel } from "./launch-options-panel.component";
import { LaunchMod, LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { OculusIcon } from "renderer/components/svgs/icons/oculus-icon.component";
import { DesktopIcon } from "renderer/components/svgs/icons/desktop-icon.component";
import { TerminalIcon } from "renderer/components/svgs/icons/terminal-icon.component";
import { DefaultConfigKey } from "renderer/config/default-configuration.config";

type Props = { version: BSVersion };

export function LaunchSlide({ version }: Props) {
    const { text: t, element: te } = useTranslationV2();

    const configService = useService(ConfigurationService);
    const bsLauncherService = useService(BSLauncherService);
    const bsDownloader = useService(BsDownloaderService);
    const versions = useService(BSVersionManagerService);

    const [advancedLaunch, setAdvancedLaunch] = useState(false);
    const [additionalArgsString, setAdditionalArgsString] = useState<string>(configService.get<string>("additionnal-args") || "");
    const versionDownloading = useObservable(() => bsDownloader.downloadingVersion$);
    const [activeLaunchMods, setActiveLaunchMods] = useState<LaunchMod[]>(configService.get("launch-mods") ?? []);
    const [pinnedLaunchMods, setPinnedLaunchMods] = useState<LaunchMod[]>(configService.get("pinned-launch-mods" as DefaultConfigKey) ?? []);
    const [launchModItems, setLaunchModItems] = useState<LaunchModItemProps[]>([]);

    const versionRunning = useObservable(() => bsLauncherService.versionRunning$);

    useEffect(() => {
        configService.set("additionnal-args", additionalArgsString);
    }, [additionalArgsString]);

    useEffect(() => {
        configService.set("pinned-launch-mods", pinnedLaunchMods);
    }, [pinnedLaunchMods])

    useEffect(() => {
        configService.set("launch-mods", activeLaunchMods);

        if(!activeLaunchMods.includes("fpfc")){
            bsLauncherService.restoreSteamVR();
        }
    }, [activeLaunchMods]);

    useEffect(() => {
        setLaunchModItems(() => [
            {
                id: LaunchMods.OCULUS,
                Icon: OculusIcon,
                label: t("pages.version-viewer.launch-mods.oculus"),
                description: t("pages.version-viewer.launch-mods.oculus-description"),
                active: activeLaunchMods.includes(LaunchMods.OCULUS),
                visible: !(version.metadata?.store === BsStore.OCULUS),
                pinned: pinnedLaunchMods.includes(LaunchMods.OCULUS),
                onChange: checked => checked ? setActiveLaunchMods(prev => [...prev, LaunchMods.OCULUS]) : setActiveLaunchMods(prev => prev.filter(mod => mod !== LaunchMods.OCULUS)),
                onPinChange: pinned => pinned ? setPinnedLaunchMods(prev => [...prev, LaunchMods.OCULUS]) : setPinnedLaunchMods(prev => prev.filter(mod => mod !== LaunchMods.OCULUS)),
            },
            {
                id: LaunchMods.FPFC,
                Icon: DesktopIcon,
                label: t("pages.version-viewer.launch-mods.desktop"),
                description: t("pages.version-viewer.launch-mods.desktop-description"),
                active: activeLaunchMods.includes(LaunchMods.FPFC),
                pinned: pinnedLaunchMods.includes(LaunchMods.FPFC),
                onChange: checked => checked ? setActiveLaunchMods(prev => [...prev, LaunchMods.FPFC]) : setActiveLaunchMods(prev => prev.filter(mod => mod !== LaunchMods.FPFC)),
                onPinChange: pinned => pinned ? setPinnedLaunchMods(prev => [...prev, LaunchMods.FPFC]) : setPinnedLaunchMods(prev => prev.filter(mod => mod !== LaunchMods.FPFC)),
            },
            {
                id: LaunchMods.DEBUG,
                Icon: TerminalIcon,
                label: t("pages.version-viewer.launch-mods.debug"),
                description: t("pages.version-viewer.launch-mods.debug-description"),
                active: activeLaunchMods.includes(LaunchMods.DEBUG),
                pinned: pinnedLaunchMods.includes(LaunchMods.DEBUG),
                onChange: checked => checked ? setActiveLaunchMods(prev => [...prev, LaunchMods.DEBUG]) : setActiveLaunchMods(prev => prev.filter(mod => mod !== LaunchMods.DEBUG)),
                onPinChange: pinned => pinned ? setPinnedLaunchMods(prev => [...prev, LaunchMods.DEBUG]) : setPinnedLaunchMods(prev => prev.filter(mod => mod !== LaunchMods.DEBUG)),
            },
            {
                id: LaunchMods.SKIP_STEAM,
                label: t("pages.version-viewer.launch-mods.skipsteam"),
                description: t("pages.version-viewer.launch-mods.skipsteam-description"),
                active: activeLaunchMods.includes(LaunchMods.SKIP_STEAM),
                pinned: pinnedLaunchMods.includes(LaunchMods.SKIP_STEAM),
                onChange: checked => checked ? setActiveLaunchMods(prev => [...prev, LaunchMods.SKIP_STEAM]) : setActiveLaunchMods(prev => prev.filter(mod => mod !== LaunchMods.SKIP_STEAM)),
                onPinChange: pinned => pinned ? setPinnedLaunchMods(prev => [...prev, LaunchMods.SKIP_STEAM]) : setPinnedLaunchMods(prev => prev.filter(mod => mod !== LaunchMods.SKIP_STEAM)),
            }
        ]);
    }, [activeLaunchMods, pinnedLaunchMods, version]);

    const launch = () => {
        const additionalArgs = additionalArgsString?.split(";").map(arg => arg.trim()).filter(arg => arg.length > 0);

        const launch$ = bsLauncherService.launch({
            version,
            launchMods: activeLaunchMods,
            additionalArgs: advancedLaunch ? additionalArgs : [],
        });

        return lastValueFrom(launch$).catch(() => {});
    };

    const isOutdated = useMemo(() => {
        return safeLt(version?.BSVersion, versions.getRecommendedVersion()?.BSVersion);
    }, [version]);

    return (
        <div className="w-full shrink-0 items-center relative flex flex-col justify-start">
            <div className="flex flex-col gap-3 justify-center items-center mb-5">
                <div className="h-24 flex justify-center items-center">
                    <BsmImage className="relative object-cover h-28" image={BSLogo} />
                </div>
                <h1 className="relative text-4xl font-bold italic -top-3">
                    {version.name ? `${version.BSVersion} - ${version.name}` : version.BSVersion}
                    {isOutdated && (
                        <Tippy theme="default" content={te("pages.version-viewer.launch-mods.outdated-tippy", { recommendedVersion: <b>{versions.getRecommendedVersion().BSVersion}</b> })}>
                            <span className="absolute bg-theme-1 size-7 rounded-full p-1.5 flex justify-center items-center -right-2 top-2 translate-x-full translate-y-px cursor-help">
                                <WarningIcon className="text-warning-400 animate-pulse"/>
                            </span>
                        </Tippy>
                    )}
                </h1>
            </div>
            <div className="grid grid-flow-col gap-6">
                {pinnedLaunchMods.map(id => launchModItems.find(mod => mod.id === id)).map(launchMod => {
                    if(launchMod?.visible === false || !launchMod?.pinned) { return undefined; }
                    return (
                        <LaunchModToogle
                            icon={launchMod.Icon}
                            infoText={launchMod.description}
                            text={launchMod.label}
                            active={launchMod.active}
                            onClick={() => launchMod.onChange(!launchMod.active)}
                        />
                    );
                })}
            </div>
            <div className="pt-4 w-2/3 flex flex-col items-center gap-3">
                <div className="relative">
                    <GlowEffect className="!rounded-full" visible={!!(advancedLaunch && additionalArgsString)}/>
                    <BsmButton
                        className={cn("rounded-full w-fit text-lg py-1 px-7 bg-theme-2 text-gray-800 dark:text-white", (advancedLaunch && additionalArgsString) ? "" : "shadow-md shadow-black")}
                        text="pages.version-viewer.launch-mods.advanced-launch.button"
                        withBar={false}
                        onClick={e => {
                            e.preventDefault();
                            setAdvancedLaunch(prev => !prev);
                        }}
                    />
                </div>
            </div>
            <LaunchOptionsPanel open={advancedLaunch} launchMods={launchModItems} className="w-full max-w-3xl mt-3" onLaunchArgsChange={setAdditionalArgsString}/>
            <div className='grow flex justify-center items-center p-2'>
                <BsmButton
                    onClick={launch}
                    active={JSON.stringify(version) === JSON.stringify(versionRunning)}
                    className='relative text-5xl text-gray-800 dark:text-gray-200 font-bold tracking-wide pt-1 pb-3 px-7 rounded-lg shadow-md italic shadow-black active:scale-90 transition-transform'
                    text="misc.launch"
                    disabled={equal(version, versionDownloading)}
                />
            </div>
        </div>
    );
}


