import { useEffect, useRef, useState } from "react";
import { lastValueFrom, Observable } from "rxjs";
import Tippy from "@tippyjs/react";
import { BSVersion } from "shared/bs-version.interface";
import {
    BS_ARM64_REPOSITORY,
    BsArm64Progress,
    BsArm64Status,
    BsArm64Unsupported,
    isBsArm64InstallerErrorCode,
} from "shared/models/bs-arm64/bs-arm64.model";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmLink } from "renderer/components/shared/bsm-link.component";
import { ToogleSwitch } from "renderer/components/shared/toogle-switch.component";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { BsArm64Service } from "renderer/services/bs-arm64.service";
import { NotificationService } from "renderer/services/notification.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { logRenderError } from "renderer";

type Props = { version: BSVersion };

const MAX_LOG_LINES = 300;

// Set once the user dismissed the Steam Frame tips (stored per device, in local storage)
const TIPS_DISMISSED_KEY = "native-arm64-tips-dismissed";

type Action = "install" | "uninstall";

/** What the panel says about the version, as a translation key under pages.version-viewer.arm64. */
export function nativeArm64StateKey(status: BsArm64Status, action?: Action): string {
    if (action) {
        return action === "install" ? "state.installing" : "state.removing";
    }
    if (status.unsupported) {
        return `unsupported.${status.unsupported}`;
    }
    if (!status.native) {
        return "state.off";
    }
    return status.installed && status.ready ? "state.on-ready" : "state.on-pending";
}

/**
 * Native ARM64 build of this version (Steam Frame), shown in the Launch tab on ARM64 Linux only.
 * On by default: the first launch installs it, and later launches keep it working. The switch
 * installs or removes it right away; the details show the installer's output.
 */
export function NativeArm64Panel({ version }: Readonly<Props>) {
    const { text: t } = useTranslationV2();
    const arm64 = useService(BsArm64Service);
    const notification = useService(NotificationService);
    const config = useService(ConfigurationService);

    const [tipsDismissed, setTipsDismissed] = useState<boolean>(() => !!config.get(TIPS_DISMISSED_KEY));
    const [status, setStatus] = useState<BsArm64Status>();
    const [action, setAction] = useState<Action>();
    const [percent, setPercent] = useState<number>();
    const [logLines, setLogLines] = useState<string[]>([]);
    const [showDetails, setShowDetails] = useState(false);
    const logRef = useRef<HTMLPreElement>(null);

    const loadStatus = () => {
        lastValueFrom(arm64.getStatus(version))
            .then(setStatus)
            .catch(e => logRenderError("Could not get native ARM64 status", e));
    };

    useEffect(loadStatus, [version]);

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, [logLines, showDetails]);

    if (!status || status.unsupported === BsArm64Unsupported.NOT_LINUX_ARM64) {
        return null;
    }

    const run = (next: Action) => {
        const obs: Observable<BsArm64Progress> = next === "install" ? arm64.install(version) : arm64.uninstall(version);
        setAction(next);
        setLogLines([]);
        setPercent(undefined);

        obs.subscribe({
            next: p => {
                if (p.percent !== undefined) {
                    setPercent(p.percent);
                }
                if (p.log) {
                    setLogLines(lines => [...lines, p.log].slice(-MAX_LOG_LINES));
                }
            },
            error: (e: { code?: string; message?: string; data?: unknown }) => {
                setAction(undefined);
                setLogLines(lines => [...lines, e?.message ?? String(e)]);
                const code = e?.code?.startsWith("BS_ARM64_") ? e.code : "BS_ARM64_INSTALLER_FAILED";
                void notification.notifyError({
                    title: `pages.version-viewer.arm64.errors.${code}`,
                    // The installer's stable error code says what to do; else its message
                    desc: isBsArm64InstallerErrorCode(e?.data) ? `pages.version-viewer.arm64.installer-errors.${e.data}` : e?.message,
                });
                loadStatus();
            },
            complete: () => {
                setAction(undefined);
                setPercent(undefined);
                void notification.notifySuccess({ title: `pages.version-viewer.arm64.notifications.${next}-success` });
                loadStatus();
            },
        });
    };

    const canSwitch = !action && !status.unsupported;
    const isOn = action ? action === "install" : status.native && !status.unsupported;

    return (
        <div className="w-full max-w-3xl px-3 mb-3">
            <div className="flex flex-col gap-1 bg-light-main-color-2 dark:bg-main-color-2 bg-opacity-90 dark:bg-opacity-90 rounded-md px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                <div className="flex items-center gap-3">
                    <Tippy content={t("pages.version-viewer.arm64.description")} theme="default" maxWidth={420}>
                        <span className="font-bold uppercase tracking-wide cursor-help whitespace-nowrap">{t("pages.version-viewer.arm64.title")}</span>
                    </Tippy>
                    <span className="grow min-w-0" data-native-arm64-state>
                        {t(`pages.version-viewer.arm64.${nativeArm64StateKey(status, action)}`, {
                            release: status.installedRelease ?? "?",
                            versions: status.supportedVersions?.join(", ") ?? "?",
                            proton: status.protonVersion ?? "?",
                        })}
                        {action && percent !== undefined && ` ${percent}%`}
                    </span>
                    <button type="button" className="underline text-xs whitespace-nowrap" onClick={() => setShowDetails(v => !v)}>
                        {t(showDetails ? "pages.version-viewer.arm64.hide-details" : "pages.version-viewer.arm64.details")}
                    </button>
                    <div className={canSwitch ? "" : "opacity-50 pointer-events-none"} aria-disabled={!canSwitch}>
                        <ToogleSwitch className="h-6 w-11" checked={isOn} onChange={checked => run(checked ? "install" : "uninstall")} />
                    </div>
                </div>

                {status.modsUnavailable && !status.unsupported && (
                    <p className="text-yellow-500">
                        {t(`pages.version-viewer.arm64.mods-unavailable.${status.modsUnavailable}`, { bsipa: status.bsipaVersion ?? "?" })}
                    </p>
                )}

                {!tipsDismissed && !status.unsupported && (
                    <div className="flex items-start gap-3 mt-1" data-native-arm64-tips>
                        <p className="grow">
                            <span className="font-bold">{t("pages.version-viewer.arm64.tips.title")} </span>
                            {t("pages.version-viewer.arm64.tips.text")}
                        </p>
                        <button
                            type="button"
                            className="underline text-xs whitespace-nowrap"
                            onClick={() => {
                                config.set(TIPS_DISMISSED_KEY, true);
                                setTipsDismissed(true);
                            }}
                        >
                            {t("pages.version-viewer.arm64.tips.dismiss")}
                        </button>
                    </div>
                )}

                {showDetails && (
                    <div className="flex flex-col gap-2 mt-1">
                        <pre ref={logRef} className="h-32 overflow-auto text-xs bg-light-main-color-3 dark:bg-main-color-1 rounded-md p-2 whitespace-pre-wrap">
                            {logLines.length ? logLines.join("\n") : t("pages.version-viewer.arm64.log-placeholder")}
                        </pre>
                        <div className="flex items-center gap-3">
                            {status.native && !status.unsupported && (
                                <BsmButton
                                    className="px-3 py-0.5 rounded-md"
                                    typeColor="primary"
                                    withBar={false}
                                    disabled={!!action}
                                    text="pages.version-viewer.arm64.reinstall"
                                    onClick={() => run("install")}
                                />
                            )}
                            <BsmLink className="text-xs underline" href={`https://github.com/${BS_ARM64_REPOSITORY}`}>
                                github.com/{BS_ARM64_REPOSITORY}
                            </BsmLink>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
