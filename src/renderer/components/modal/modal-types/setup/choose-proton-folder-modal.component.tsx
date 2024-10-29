import { lastValueFrom } from "rxjs";
import { useState } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useService } from "renderer/hooks/use-service.hook";

import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { NotificationService } from "renderer/services/notification.service";
import { StaticConfigurationService } from "renderer/services/static-configuration.service";

import { BsmButton } from "renderer/components/shared/bsm-button.component";

export const ChooseProtonFolderModal: ModalComponent<{}, {}> = ({ resolver }) => {

    const t = useTranslation();
    const ipcService = useService(IpcService);
    const notificationService = useService(NotificationService);
    const staticConfigService = useService(StaticConfigurationService);

    const [protonFolder, setProtonFolder] = useState(null);

    const selectProtonPath = async () => {
        const response = await lastValueFrom(ipcService.sendV2("choose-folder", {
            parent: "home",
            defaultPath: ".local/share/Steam/steamapps/common",
            showHidden: true,
        }));

        if (response.canceled || !response.filePaths?.length) {
            return;
        }

        const path = response.filePaths[0];

        await staticConfigService.set("proton-folder", path).then(() => {
            setProtonFolder(path);
        }).catch(err => {
            notificationService.notifyError({
                title: "pages.settings.proton-folder.errors.title",
                desc: ["invalid-folder"].includes(err?.code)
                    ? `pages.settings.proton-folder.errors.${err.code}`
                    : "misc.unknown"
            });
        });
    }

    const onConfirmButtonPressed = async () => {
        resolver({
            exitCode: ModalExitCode.COMPLETED
        });
    }

    return (
        <form
            className="max-w-lg w-max flex flex-col gap-3"
            onSubmit={event => {
                event.preventDefault();
                onConfirmButtonPressed();
            }}>

            <h1 className="tracking-wide w-full uppercase text-3xl text-center mb-4">{t("modals.choose-proton-folder.title")}</h1>

            <p>{t("modals.choose-proton-folder.proton-folder-description")}</p>

            <a className="underline" href="https://github.com/ValveSoftware/Proton/wiki/Proton-FAQ#where-is-proton-installed" target="_blank">{t("modals.choose-proton-folder.where-is-proton-installed")}</a>
            <div className="relative flex items-center justify-between w-full h-8 bg-light-main-color-1 dark:bg-main-color-1 rounded-md pl-2 py-1">
                    {protonFolder ? (
                        <span
                            className="block text-ellipsis overflow-hidden min-w-0 whitespace-nowrap"
                            title={protonFolder}
                        >
                            {protonFolder}
                        </span>
                    ) : (
                        <span className="text-gray-500 italic font-bold">{t("modals.choose-proton-folder.proton-folder-placeholder")}</span>
                    )}
                    <BsmButton
                        onClick={selectProtonPath}
                        className="shrink-0 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md"
                        text="misc.choose-folder"
                        withBar={false}
                    />
            </div>

            <div className="h-8 grid grid-flow-col grid-cols-1">
                <BsmButton
                    typeColor="primary"
                    className="rounded-md text-center transition-all"
                    type="submit"
                    withBar={false}
                    text="misc.confirm"
                    disabled={!protonFolder}
                />
            </div>
        </form>
    )
}
