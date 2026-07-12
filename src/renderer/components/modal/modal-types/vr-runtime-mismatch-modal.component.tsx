import { useEffect, useRef, useState } from "react";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmLink } from "renderer/components/shared/bsm-link.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { VrRuntime } from "shared/models/vr-runtime.model";

export const VrRuntimeMismatchModal: ModalComponent<boolean, VrRuntime> = ({ resolver, options }) => {
    const t = useTranslation();
    const [dontRemindAgain, setDontRemindAgain] = useState(false);
    const cancelButton = useRef<HTMLButtonElement>(null);
    const activeRuntime = t(`modals.vr-runtime-mismatch.runtimes.${options?.data ?? VrRuntime.UNKNOWN}`);
    const titleId = "vr-runtime-warning-title";
    const checkboxId = "vr-runtime-warning-dismiss";

    useEffect(() => {
        cancelButton.current?.focus();
    }, []);

    return (
        <form
            aria-labelledby={titleId}
            aria-modal="true"
            className="text-gray-800 dark:text-gray-200 flex flex-col w-[min(420px,calc(100vw-4rem))] min-w-0"
            role="dialog"
            onSubmit={event => {
                event.preventDefault();
                resolver({ exitCode: ModalExitCode.COMPLETED, data: dontRemindAgain });
            }}
        >
            <h1 id={titleId} className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.vr-runtime-mismatch.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <div className="flex flex-col gap-3">
                <p>{t("modals.vr-runtime-mismatch.body.active-runtime", { activeRuntime })}</p>
                <p className="text-sm italic">{t("modals.vr-runtime-mismatch.body.info")}</p>
                <p className="text-sm">{t("modals.vr-runtime-mismatch.body.info-2")}</p>
            </div>
            <div className="flex justify-start items-center *:underline *:text-sm *:text-gray-700 dark:*:text-neutral-200">
                <BsmLink href="https://github.com/Zagrios/bs-manager/wiki/Configure-OpenXR-Runtime">
                    {t("modals.vr-runtime-mismatch.tutorial")}
                </BsmLink>
            </div>
            <label htmlFor={checkboxId} className="flex flex-row justify-start items-center gap-1.5 my-4 cursor-pointer">
                <input
                    checked={dontRemindAgain}
                    className="size-5 cursor-pointer"
                    id={checkboxId}
                    type="checkbox"
                    onChange={event => setDontRemindAgain(event.target.checked)}
                />
                <span>{t("modals.vr-runtime-mismatch.dont-remind-me")}</span>
            </label>
            <div className="grid grid-flow-col grid-cols-2 gap-4">
                <button ref={cancelButton} type="button" className="rounded-md text-center transition-all h-8 bg-gray-500 text-white hover:brightness-110" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })}>
                    {t("misc.cancel")}
                </button>
                <button type="submit" className="rounded-md text-center transition-all h-8 bg-theme-1 hover:brightness-110">
                    {t("modals.vr-runtime-mismatch.launch-anyway")}
                </button>
            </div>
        </form>
    );
};
