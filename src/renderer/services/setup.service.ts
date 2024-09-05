import { lastValueFrom } from "rxjs";
import { logRenderError } from "renderer";

import { BSVersionManagerService } from "./bs-version-manager.service";
import { InstallationLocationService } from "./installation-location.service";
import { IpcService } from "./ipc.service";
import { ModalService } from "./modale.service";

import { AskInstallPathModal } from "renderer/components/modal/modal-types/ask-install-path.component";

// Handle setup modals/prompts, ordering of the modals/prompts may be done here
export class SetupService {
    private static instance: SetupService;

    private readonly installationLocationService: InstallationLocationService;
    private readonly ipcService: IpcService;
    private readonly modalService: ModalService;
    private readonly versionManagerService: BSVersionManagerService;

    private constructor() {
        this.installationLocationService = InstallationLocationService.getInstance();
        this.ipcService = IpcService.getInstance();
        this.modalService = ModalService.getInstance();
        this.versionManagerService = BSVersionManagerService.getInstance();
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

}
