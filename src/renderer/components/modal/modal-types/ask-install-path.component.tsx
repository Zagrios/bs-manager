import { lastValueFrom } from "rxjs";
import { useEffect, useState } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useService } from "renderer/hooks/use-service.hook";

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
            className="static min-w-96"
            onSubmit={event => {
                event.preventDefault();
                onConfirmButtonPressed();
            }}>

            <h1 className="
                tracking-wide w-full
                uppercase text-3xl text-center text-gray-800 dark:text-gray-200
            ">
                {t("modals.ask-install-path.title")}
            </h1>

            <div className="
                relative rounded-md pl-2 py-1 my-3
                flex items-center justify-between
                w-full h-8 bg-light-main-color-1 dark:bg-main-color-1
            ">
                <span className="block text-ellipsis overflow-hidden min-w-0" title={installPath}>
                    {installPath}
                </span>
                <BsmButton
                    onClick={selectInstallPath}
                    className="shrink-1 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md"
                    text={"modals.ask-install-path.choose-folder"}
                    withBar={false}
                />
            </div>

            <div className="grid grid-flow-col grid-cols-4 row-start-3 gap-4">
                <BsmButton
                    typeColor="cancel"
                    className="col-start-3 rounded-md text-center transition-all"
                    onClick={onDefaultButtonPressed}
                    withBar={false}
                    text={"modals.ask-install-path.default"}
                />
                <BsmButton
                    typeColor="primary"
                    className="col-start-4 z-0 px-1 rounded-md text-center transition-all"
                    type="submit"
                    withBar={false}
                    text={"misc.confirm"}
                />
            </div>
        </form>
    )
}
