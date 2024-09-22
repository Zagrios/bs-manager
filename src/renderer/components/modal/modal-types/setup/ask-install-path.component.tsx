import { lastValueFrom } from "rxjs";
import { useEffect, useState } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useService } from "renderer/hooks/use-service.hook";
import Tippy from "@tippyjs/react";

import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";

import { BsmButton } from "renderer/components/shared/bsm-button.component";

export const AskInstallPathModal: ModalComponent<{ installPath: string }, {}> = ({ resolver }) => {

    const t = useTranslation();
    const ipcService = useService(IpcService);

    const [installPath, setInstallPath] = useState("");
    const [installFolder, setInstallFolder] = useState("");
    const [defaultInstallPath, setDefaultInstallPath] = useState("");

    useEffect(() => {
        lastValueFrom(ipcService.sendV2("bs-installer.default-install-path"))
            .then(defaultPath => {
                setInstallPath(defaultPath);
                setDefaultInstallPath(defaultPath);
                setInstallFolder(window.electron.path.basename(defaultPath));
            });
    }, []);

    const selectInstallPath = async () => {
        const response = await lastValueFrom(ipcService.sendV2("choose-folder"));
        if (response.canceled || !response.filePaths?.length) {
            return;
        }

        const path = response.filePaths[0];
        setInstallPath(
            window.electron.path.basename(path) === installFolder ?
                path :
                window.electron.path.join(response.filePaths[0], installFolder)
        );
    }

    const onDefaultButtonPressed = () => {
        setInstallPath(defaultInstallPath);
    }

    const onConfirmButtonPressed = () => {
        resolver({
            data: { installPath },
            exitCode: ModalExitCode.COMPLETED
        });
    }

    return (
        <form
            className="max-w-xl w-max"
            onSubmit={event => {
                event.preventDefault();
                onConfirmButtonPressed();
            }}>

            <h1 className="tracking-wide w-full uppercase text-3xl text-center">
                {t("modals.ask-install-path.title")}
            </h1>

            <p className="py-3">
                {t("modals.ask-install-path.choose-folder-description")}
            </p>

            <div className="relative rounded-md pl-2 py-1 mb-3 flex items-center justify-between gap-1 w-full h-8 bg-light-main-color- dark:bg-main-color-1">
                <span className="text-ellipsis overflow-hidden min-w-0 text-nowrap text-left cursor-help" title={installPath} style={{ direction: "rtl" }}>
                    {installPath}
                </span>
                <BsmButton
                    onClick={selectInstallPath}
                    className="shrink-0 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md"
                    text="modals.ask-install-path.choose-folder"
                    withBar={false}
                />
            </div>

            <div className="h-8 grid grid-flow-col grid-cols-2 gap-2">
                <Tippy
                    content={t("modals.ask-install-path.default-tooltip")}
                    theme="default"
                    delay={[300, 0]}
                    arrow={false}
                    placement="bottom"
                >
                    <BsmButton
                        typeColor="cancel"
                        className="rounded-md text-center transition-all flex items-center justify-center"
                        onClick={onDefaultButtonPressed}
                        withBar={false}
                        text="modals.ask-install-path.default"
                    />
                </Tippy>
                <BsmButton
                    typeColor="primary"
                    className="rounded-md text-center transition-all"
                    type="submit"
                    withBar={false}
                    text="misc.confirm"
                />
            </div>
        </form>
    )
}
