import { lastValueFrom } from "rxjs";
import { useState } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useService } from "renderer/hooks/use-service.hook";

import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { NotificationService } from "renderer/services/notification.service";
import { StaticConfigurationService } from "renderer/services/static-configuration.service";

import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { SettingContainer } from "renderer/components/settings/setting-container.component";

export const LinuxSetupModal: ModalComponent<{}, {}> = ({ resolver }) => {

    const t = useTranslation();
    const ipcService = useService(IpcService);
    const notificationService = useService(NotificationService);
    const staticConfigService = useService(StaticConfigurationService);

    const [protonFolder, setProtonFolder] = useState("");

    const validateFields = () => {
        return !!protonFolder;
    }

    const selectProtonPath = async () => {
        const response = await lastValueFrom(ipcService.sendV2("choose-folder"));
        if (response.canceled || !response.filePaths?.length) {
            return;
        }

        const path = response.filePaths[0];
        try {
            await staticConfigService.set("proton-folder", path);
            setProtonFolder(path);
            validateFields();
        } catch (error: any) {
            notificationService.notifyError({
                title: "pages.settings.proton-folder.errors.title",
                desc: ["invalid-folder"].includes(error?.code)
                    ? `pages.settings.proton-folder.errors.${error.code}`
                    : "misc.unknown"
            });
        }
    }

    const onConfirmButtonPressed = async () => {
        resolver({
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

            <h1 className="tracking-wide w-full uppercase text-3xl text-center mb-4">
                {t("modals.linux-setup.title")}
            </h1>

            <SettingContainer
                os="linux"
                title="modals.linux-setup.proton-folder"
                description="modals.linux-setup.proton-folder-description"
            >
                <div className="relative flex items-center justify-between w-full h-8 bg-light-main-color-1 dark:bg-main-color-1 rounded-md pl-2 py-1">
                    <span
                        className="block text-ellipsis overflow-hidden min-w-0 whitespace-nowrap"
                        title={protonFolder}
                    >
                        {protonFolder}
                    </span>
                    <BsmButton
                        onClick={selectProtonPath}
                        className="shrink-0 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md"
                        text="modals.linux-setup.choose-folder"
                        withBar={false}
                    />
                </div>
            </SettingContainer>

            <div className="h-8 grid grid-flow-col grid-cols-1">
                <BsmButton
                    typeColor="primary"
                    className="rounded-md text-center transition-all"
                    type="submit"
                    withBar={false}
                    text="misc.confirm"
                    disabled={!validateFields()}
                />
            </div>
        </form>
    )
}
