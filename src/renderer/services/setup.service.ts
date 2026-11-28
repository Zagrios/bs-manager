import { lastValueFrom } from "rxjs";
import { logRenderError } from "renderer";

import { BSVersionManagerService } from "./bs-version-manager.service";
import { InstallationLocationService } from "./installation-location.service";
import { IpcService } from "./ipc.service";
import { ModalService } from "./modale.service";
import { BsArm64Service } from "./bs-arm64.service";
import { NotificationService } from "./notification.service";

import { AskInstallPathModal } from "renderer/components/modal/modal-types/setup/ask-install-path.component";
import { ChooseProtonFolderModal } from "renderer/components/modal/modal-types/setup/choose-proton-folder-modal.component";

// Handle setup modals/prompts, ordering of the modals/prompts may be done here
export class SetupService {
    private static instance: SetupService;

    private readonly installationLocationService: InstallationLocationService;
    private readonly ipcService: IpcService;
    private readonly modalService: ModalService;
    private readonly versionManagerService: BSVersionManagerService;
    private readonly bsArm64Service: BsArm64Service;
    private readonly notificationService: NotificationService;

    private constructor() {
        this.installationLocationService = InstallationLocationService.getInstance();
        this.ipcService = IpcService.getInstance();
        this.modalService = ModalService.getInstance();
        this.versionManagerService = BSVersionManagerService.getInstance();
        this.bsArm64Service = BsArm64Service.getInstance();
        this.notificationService = NotificationService.getInstance();
    }

    public static getInstance(): SetupService {
        if (!SetupService.instance) {
            SetupService.instance = new SetupService();
        }
        return SetupService.instance;
    }

    public async check(): Promise<void> {
        try {
            // NOTE: for modal sequencing
            await this.checkInstallationPath();

            if (window.electron.platform === "linux") {
                await this.checkProtonFolder();
            }
        } catch (error) {
            logRenderError(error);
        }
    }

    private async checkInstallationPath(): Promise<void> {
        try {
            const exists = await lastValueFrom(this.ipcService.sendV2("bs-installer.folder-exists"));
            if (exists) {
                return;
            }

            const modalResponse = await this.modalService.openModal(
                AskInstallPathModal,
                { closable: false }
            );

            await lastValueFrom(this.installationLocationService.setInstallationFolder(modalResponse.data.installPath, false));

            // Refresh the versions tab
            await this.versionManagerService.askInstalledVersions();
        } catch (error) {
            logRenderError(error);
        }
    }

    private async checkProtonFolder(): Promise<void> {
        try {
            const valid = await lastValueFrom(this.ipcService.sendV2("linux.verify-proton-folder"));
            if (valid) {
                return;
            }

            // On ARM64 (Steam Frame), select an ARM64 Proton from the Steam libraries if there is one
            const auto = await lastValueFrom(this.bsArm64Service.autoSelectProtonFolder()).catch((): undefined => undefined);
            if (auto?.folder) {
                this.notificationService.notifySuccess({ title: "modals.choose-proton-folder.auto-selected", desc: auto.folder }).catch(logRenderError);
                return;
            }

            await this.modalService.openModal(
                ChooseProtonFolderModal,
                { closable: false, data: { arm64: !!auto?.arm64 } }
            );
        } catch (error) {
            logRenderError(error);
        }
    }

}
