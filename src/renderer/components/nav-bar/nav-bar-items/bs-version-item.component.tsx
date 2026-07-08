import { BSVersion } from "shared/bs-version.interface";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MouseEventHandler, useEffect, useMemo, useState } from "react";
import { distinctUntilChanged, lastValueFrom, map, of, Subject, Subscription, switchMap, take } from "rxjs";
import { BSLauncherService } from "renderer/services/bs-launcher.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { IpcService } from "renderer/services/ipc.service";
import { BSUninstallerService } from "renderer/services/bs-uninstaller.service";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { ModalExitCode, ModalService } from "renderer/services/modale.service";
import { BsmIcon, BsmIconType } from "../../svgs/bsm-icon.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { NavBarItem } from "./nav-bar-item.component";
import useFitText from "use-fit-text";
import Tippy from "@tippyjs/react";
import { useService } from "renderer/hooks/use-service.hook";
import equal from "fast-deep-equal";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { BsDownloaderService } from "renderer/services/bs-version-download/bs-downloader.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { noop } from "shared/helpers/function.helpers";
import { NotificationService } from "renderer/services/notification.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { ShareFoldersModal } from "renderer/components/modal/modal-types/share-folders-modal.component";
import { UninstallModal } from "renderer/components/modal/modal-types/uninstall-modal.component";
import { CreateLaunchShortcutModal } from "renderer/components/modal/modal-types/create-launch-shortcut-modal.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";

type VersionContextMenuItem = {
    text: string;
    icon?: BsmIconType;
    onClick: () => void | Promise<void>;
};

// Emits the id of the version item whose context menu just opened, so every
// other item can close its own menu (only one context menu open at a time).
const contextMenuOpened$ = new Subject<string>();

export function BsVersionItem(props: { version: BSVersion }) {

    const bsDownloader = useService(BsDownloaderService);
    const verionManagerService = useService(BSVersionManagerService);
    const launcherService = useService(BSLauncherService);
    const configService = useService(ConfigurationService);
    const bsUninstallerService = useService(BSUninstallerService);
    const progressBar = useService(ProgressBarService);
    const ipcService = useService(IpcService);
    const modalService = useService(ModalService);
    const notification = useService(NotificationService);
    const t = useTranslation();
    const navigate = useNavigate();

    const { state } = useLocation() as { state: BSVersion };
    const { fontSize, ref } = useFitText();

    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const secondColor = useThemeColor("second-color");

    const itemId = useMemo(() => JSON.stringify(props.version), [props.version]);
    const [menuVisible, setMenuVisible] = useState(false);

    useOnUpdate(() => {
        const subs: Subscription[] = []

        subs.push(bsDownloader.downloadingVersion$.pipe(map(download => equal(download, props.version)), distinctUntilChanged()).subscribe(isDownloading => {
            setIsDownloading(() => isDownloading);
        }));

        subs.push(bsDownloader.downloadingVersion$.pipe(
            map(download => equal(download, props.version)),
            distinctUntilChanged(),
            switchMap(isDownloading => isDownloading ? progressBar.progress$ : of(0)),
        ).subscribe(progress => {
            setDownloadProgress(() => progress);
        }));

        return () => subs.forEach(sub => sub.unsubscribe());
    }, [props.version]);

    useEffect(() => {
        const sub = contextMenuOpened$.subscribe(openedId => {
            if (openedId !== itemId) {
                setMenuVisible(false);
            }
        });
        return () => sub.unsubscribe();
    }, [itemId]);

    const isActive = (): boolean => {
        return props.version?.BSVersion === state?.BSVersion && props?.version.steam === state?.steam && props?.version.oculus === state?.oculus && props?.version.name === state?.name;
    };

    const navigateToVersion = (version?: BSVersion) => {
        if (!version) {
            return navigate("/available-versions");
        }

        navigate(`/bs-version/${version.BSVersion}`, { state: version });
    };

    const handleDoubleClick = async () => {
        const downloadingVersion = await lastValueFrom(bsDownloader.downloadingVersion$.pipe(take(1)));
        if(equal(downloadingVersion, props.version)){ return; }
        const launch$ = launcherService.launch({
            version: state,
            launchMods: configService.get("launch-mods") ?? [],
        });
        return lastValueFrom(launch$).catch(() => {});
    };

    const cancel = () => {
        const versionDownload = bsDownloader.downloadingVersion;
        const wasVerification = bsDownloader.isVerifying;
        bsDownloader.stopDownload().then(() => {
            if(wasVerification){ return; }
            bsUninstallerService.uninstall(versionDownload).then(() => verionManagerService.askInstalledVersions()).catch(noop);
        });
    };

    const renderIcon = () => {
        const classes = "w-[19px] h-[19px] mr-[5px] shrink-0";
        if (props.version.steam) {
            return <BsmIcon icon="steam" className={classes} />;
        }
        if (props.version.oculus) {
            return <BsmIcon icon="oculus" className={`${classes} p-[2px] rounded-full bg-main-color-1 text-white dark:bg-white dark:text-black`} />;
        }
        return <BsmIcon icon="bsNote" className={classes} style={{ color: props.version?.color ?? secondColor }} />;
    };

    const renderVersionText = () => {
        if (props.version.name) {
            return (
                <div className="h-8 flex items-center dark:text-gray-200 text-gray-800 overflow-hidden">
                    <div ref={ref} className="whitespace-nowrap font-bold tracking-wide w-full text-center" style={{ fontSize }}>
                        {props.version.name}
                    </div>
                </div>
            );
        }
        return (
            <div className="h-8 flex items-center text-xl dark:text-gray-200 text-gray-800 font-bold tracking-wide">
                <span className="pb-[2px] max-w-full text-ellipsis">{props.version.BSVersion}</span>
            </div>
        );
    };

    const openFolder = () => lastValueFrom(ipcService.sendV2("bs-version.open-folder", props.version)).catch(noop);
    const verifyFiles = () => bsDownloader.verifyBsVersion(props.version).then(() => {}).catch(noop);

    const openContextMenu: MouseEventHandler<HTMLElement> = e => {
        e.preventDefault();
        e.stopPropagation();

        if (isDownloading || bsDownloader.downloadingVersion || bsDownloader.isVerifying || !progressBar.require()) {
            return;
        }

        contextMenuOpened$.next(itemId);
        setMenuVisible(true);
    };

    const menuItems: VersionContextMenuItem[] = [
        { text: "pages.version-viewer.dropdown.open-folder", icon: "folder", onClick: openFolder },
        { text: "pages.version-viewer.dropdown.verify-files", icon: "task", onClick: verifyFiles },
        ...(!props.version.steam && !props.version.oculus ? [{
            text: "pages.version-viewer.dropdown.edit",
            icon: "edit" as const,
            onClick: () => verionManagerService.editVersion(props.version).then(newVersion => {
                if (newVersion) {
                    navigateToVersion(newVersion);
                }
            }),
        }] : []),
        ...(!props.version.oculus ? [{
            text: "pages.version-viewer.dropdown.clone",
            icon: "copy" as const,
            onClick: () => verionManagerService.cloneVersion(props.version).then(newVersion => {
                if (newVersion) {
                    navigateToVersion(newVersion);
                }
            }),
        }] : []),
        {
            text: "pages.version-viewer.dropdown.shared-folders",
            icon: "link",
            onClick: () => modalService.openModal(ShareFoldersModal, { data: props.version }).then(() => {}),
        },
        {
            text: "pages.version-viewer.dropdown.create-shortcut",
            icon: "shortcut",
            onClick: async () => {
                const res = await modalService.openModal(CreateLaunchShortcutModal, { data: props.version });
                if (res.exitCode !== ModalExitCode.COMPLETED) {
                    return;
                }

                return lastValueFrom(launcherService.createLaunchShortcut(res.data.launchOption, res.data.steamShortcut)).then(() => {
                    return notification.notifySuccess({
                        title: "notifications.create-launch-shortcut.success.title",
                        desc: `notifications.create-launch-shortcut.success.${res.data.steamShortcut ? "msg-steam" : "msg"}`
                    }).then(() => {});
                }).catch(() => {
                    return notification.notifyError({
                        title: "notifications.types.error",
                        desc: "notifications.create-launch-shortcut.error.msg"
                    }).then(() => {});
                });
            }
        },
        ...(!props.version.steam && !props.version.oculus ? [{
            text: "pages.version-viewer.dropdown.uninstall",
            icon: "trash" as const,
            onClick: async () => {
                const modalRes = await modalService.openModal(UninstallModal, { data: props.version });
                if (modalRes.exitCode !== ModalExitCode.COMPLETED) {
                    return;
                }

                const wasActive = isActive();

                return bsUninstallerService.uninstall(props.version).then(() => {
                    return verionManagerService.askInstalledVersions().then(versions => {
                        if (wasActive) {
                            navigateToVersion(versions?.at(0));
                        }
                    });
                }).catch((err: CustomError) => {
                    let desc = err?.message;

                    if (["CantDeleteOfficialVersion", "VersionNotFound"].includes(err?.code)) {
                        desc = `notifications.bs-uninstall.errors.desc.${err.code}`;
                    } else if (err?.code?.startsWith("generic.fs.delete-folder")) {
                        desc = "notifications.bs-uninstall.errors.desc.delete-folder";
                    }

                    return notification.notifyError({ title: "notifications.bs-uninstall.errors.title", desc }).then(() => {});
                });
            }
        }] : []),
    ];

    const menuContent = (
        <ul className="py-1 min-w-[200px] text-sm cursor-pointer">
            {menuItems.map(item => (
                <li key={item.text}>
                    <button
                        type="button"
                        onClick={() => {
                            setMenuVisible(false);
                            Promise.resolve(item.onClick()).catch(noop);
                        }}
                        className="flex w-full items-center px-3 py-2 text-left hover:backdrop-brightness-125"
                    >
                        {item.icon && <BsmIcon icon={item.icon} className="h-5 w-5 mr-2 text-inherit shrink-0" />}
                        <span className="whitespace-nowrap">{t(item.text)}</span>
                    </button>
                </li>
            ))}
        </ul>
    );

    return (
        <NavBarItem onCancel={cancel} progress={downloadProgress} isActive={isActive() && !isDownloading} isDownloading={isDownloading}>
            <Tippy
                visible={menuVisible}
                onClickOutside={() => setMenuVisible(false)}
                interactive
                placement="right-start"
                arrow
                appendTo={() => document.body}
                theme="version-context-menu"
                animation="shift-away-subtle"
                duration={[100, 0]}
                offset={[0, 12]}
                content={menuContent}
            >
                <div className="w-full flex items-center justify-start" onContextMenu={openContextMenu}>
                    {props.version.name ? (
                        <Tippy content={props.version.BSVersion} placement="right-end" arrow={false} className="font-bold !bg-neutral-900" duration={[100, 0]} animation="shift-away-subtle" disabled={menuVisible}>
                            <Link onDoubleClick={handleDoubleClick} to={`/bs-version/${props.version.BSVersion}`} state={props.version} className="w-full flex items-center justify-start content-center max-w-full">
                                {renderIcon()}
                                {renderVersionText()}
                            </Link>
                        </Tippy>
                    ) : (
                        <Link onDoubleClick={handleDoubleClick} to={`/bs-version/${props.version.BSVersion}`} state={props.version} className="w-full flex items-center justify-start content-center max-w-full">
                            {renderIcon()}
                            {renderVersionText()}
                        </Link>
                    )}
                </div>
            </Tippy>
        </NavBarItem>
    );
}
