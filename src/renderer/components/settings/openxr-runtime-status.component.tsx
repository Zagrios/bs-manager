import { useCallback, useEffect, useState } from "react";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ConfigurationService } from "renderer/services/configuration.service";
import { IpcService } from "renderer/services/ipc.service";
import { lastValueFrom } from "rxjs";
import { VrRuntime, VR_RUNTIME_WARNING_DISMISS_KEY } from "shared/models/vr-runtime.model";

export function OpenXrRuntimeStatus() {
    const config = useService(ConfigurationService);
    const ipc = useService(IpcService);
    const t = useTranslation();
    const [activeRuntime, setActiveRuntime] = useState<VrRuntime>(null);
    const [warningDisabled, setWarningDisabled] = useState(() => config.get<boolean>(VR_RUNTIME_WARNING_DISMISS_KEY) ?? false);

    const refreshRuntime = useCallback(() => {
        if (window.electron.platform !== "win32") {
            return Promise.resolve();
        }

        return lastValueFrom(ipc.sendV2("vr-runtime.get-active"))
            .then(setActiveRuntime)
            .catch(() => setActiveRuntime(VrRuntime.UNKNOWN));
    }, [ipc]);

    useEffect(() => {
        refreshRuntime();

        const onFocus = () => refreshRuntime();
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                refreshRuntime();
            }
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [refreshRuntime]);

    if (window.electron.platform !== "win32") {
        return null;
    }

    const runtime = activeRuntime
        ? t(`modals.vr-runtime-mismatch.runtimes.${activeRuntime}`)
        : "...";

    const restoreWarning = () => {
        config.delete(VR_RUNTIME_WARNING_DISMISS_KEY);
        setWarningDisabled(false);
    };

    return (
        <div className="flex flex-wrap justify-end items-center gap-2">
            <span aria-live="polite" className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md py-1 px-2 font-bold">
                {t("pages.settings.openxr.status", { runtime })}
            </span>
            <button type="button" className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md py-1 px-2 font-bold hover:brightness-110" onClick={refreshRuntime}>
                {t("pages.settings.openxr.refresh")}
            </button>
            {warningDisabled && (
                <button type="button" className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md py-1 px-2 font-bold hover:brightness-110" onClick={restoreWarning}>
                    {t("pages.settings.openxr.restore-warning")}
                </button>
            )}
        </div>
    );
}
