import { BehaviorSubject, lastValueFrom, of } from "rxjs";
import { BSLauncherService } from "renderer/services/bs-launcher.service";
import { LaunchOption } from "shared/models/bs-launch";
import { LaunchMod, LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { BsStore } from "shared/models/bs-store.enum";
import { VrRuntime } from "shared/models/vr-runtime.model";

jest.mock("renderer/services/ipc.service", () => ({ IpcService: { getInstance: jest.fn() } }));
jest.mock("renderer/services/notification.service", () => ({ NotificationService: { getInstance: jest.fn() } }));
jest.mock("renderer/services/configuration.service", () => ({ ConfigurationService: { getInstance: jest.fn() } }));
jest.mock("renderer/services/theme.service", () => ({ ThemeService: { getInstance: jest.fn() } }));
jest.mock("renderer/services/modale.service", () => ({
    ModalExitCode: { COMPLETED: 0, CANCELED: 2 },
    ModalService: { getInstance: jest.fn() },
}));
jest.mock("renderer/components/modal/modal-types/enable-oculus-sideloaded-apps", () => ({ EnableOculusSideloadedApps: jest.fn() }));
jest.mock("renderer/components/modal/modal-types/need-launch-admin-modal.component", () => ({ NeedLaunchAdminModal: jest.fn() }));
jest.mock("renderer/components/modal/modal-types/vr-runtime-mismatch-modal.component", () => ({ VrRuntimeMismatchModal: jest.fn() }));

function buildLaunchOptions(launchMods: LaunchMod[] = []): LaunchOption {
    return {
        version: {
            BSVersion: "1.40.0",
            name: "runtime-test",
            steam: true,
            oculus: false,
        },
        launchMods,
    };
}

function buildService(activeRuntime: VrRuntime = VrRuntime.NOT_SET) {
    const sendV2 = jest.fn((channel: string) => {
        if (channel === "vr-runtime.get-active") {
            return of(activeRuntime);
        }
        if (channel === "bs-launch.launch") {
            return of({ type: "BS_LAUNCHED" });
        }
        if (channel === "is-oculus-sideloaded-apps-enabled") {
            return of(false);
        }
        if (channel === "enable-oculus-sideloaded-apps") {
            return of(undefined);
        }
        throw new Error(`Unexpected IPC channel: ${channel}`);
    });
    const openModal = jest.fn().mockResolvedValue({ exitCode: 0, data: false });
    const config = { get: jest.fn<boolean, [string?]>().mockReturnValue(false), set: jest.fn() };
    const service = Object.create(BSLauncherService.prototype) as BSLauncherService;

    Object.assign(service as any, {
        ipcService: { sendV2 },
        config,
        modals: { openModal },
        notificationService: {
            notifyWarning: jest.fn(),
            notifySuccess: jest.fn(),
            notifyError: jest.fn(),
        },
        versionRunning$: new BehaviorSubject(null),
    });

    return { service, sendV2, openModal, config };
}

describe("renderer BSLauncherService OpenXR checks", () => {
    beforeAll(() => {
        Object.defineProperty(global, "window", {
            configurable: true,
            value: { electron: { platform: "win32" } },
        });
    });

    it("checks the runtime before direct shortcut launches", async () => {
        const { service, sendV2, openModal } = buildService();

        await lastValueFrom(service.doLaunch(buildLaunchOptions()));

        expect(sendV2.mock.calls.map(([channel]) => channel)).toEqual([
            "vr-runtime.get-active",
            "bs-launch.launch",
        ]);
        expect(openModal).toHaveBeenCalledTimes(1);
    });

    it("checks the runtime with launch-specific environment overrides", async () => {
        const { service, sendV2 } = buildService();
        const launchOptions = buildLaunchOptions();
        launchOptions.command = "XR_RUNTIME_JSON=C:\\VirtualDesktop\\vdxr.json %command%";

        await lastValueFrom(service.doLaunch(launchOptions));

        expect(sendV2).toHaveBeenCalledWith("vr-runtime.get-active", launchOptions.command);
    });

    it("skips the runtime check for headset-free FPFC launches", async () => {
        const { service, sendV2, openModal } = buildService();

        await lastValueFrom(service.doLaunch(buildLaunchOptions([LaunchMods.FPFC])));

        expect(sendV2.mock.calls.map(([channel]) => channel)).toEqual(["bs-launch.launch"]);
        expect(openModal).not.toHaveBeenCalled();
    });

    it.each([LaunchMods.OCULUS, LaunchMods.EDITOR])("skips the runtime check for %s launches", async launchMod => {
        const { service, sendV2, openModal } = buildService();

        await lastValueFrom(service.doLaunch(buildLaunchOptions([launchMod])));

        expect(sendV2.mock.calls.map(([channel]) => channel)).toEqual(["bs-launch.launch"]);
        expect(openModal).not.toHaveBeenCalled();
    });

    it("skips the runtime check for Beat Saber versions before OpenXR", async () => {
        const { service, sendV2, openModal } = buildService();
        const launchOptions = buildLaunchOptions();
        launchOptions.version.BSVersion = "1.29.1";

        await lastValueFrom(service.doLaunch(launchOptions));

        expect(sendV2.mock.calls.map(([channel]) => channel)).toEqual(["bs-launch.launch"]);
        expect(openModal).not.toHaveBeenCalled();
    });

    it("shows registry read failures as UNKNOWN in the confirmation modal", async () => {
        const { service, openModal } = buildService(VrRuntime.UNKNOWN);

        await lastValueFrom(service.doLaunch(buildLaunchOptions()));

        expect(openModal).toHaveBeenCalledWith(expect.anything(), { data: VrRuntime.UNKNOWN });
    });

    it.each([VrRuntime.STEAM, VrRuntime.OCULUS, VrRuntime.VDXR, VrRuntime.OTHER])("launches without prompting when %s is active", async activeRuntime => {
        const { service, sendV2, openModal } = buildService(activeRuntime);

        await lastValueFrom(service.doLaunch(buildLaunchOptions()));

        expect(sendV2.mock.calls.map(([channel]) => channel)).toEqual([
            "vr-runtime.get-active",
            "bs-launch.launch",
        ]);
        expect(openModal).not.toHaveBeenCalled();
    });

    it("launches without checking the runtime when the reminder is disabled", async () => {
        const { service, sendV2, openModal, config } = buildService();
        config.get.mockImplementation(key => key === "dont-remind-vr-runtime");

        await lastValueFrom(service.doLaunch(buildLaunchOptions()));

        expect(sendV2.mock.calls.map(([channel]) => channel)).toEqual(["bs-launch.launch"]);
        expect(openModal).not.toHaveBeenCalled();
    });

    it("persists the reminder preference when the runtime confirmation is accepted", async () => {
        const { service, openModal, config } = buildService();
        openModal.mockResolvedValueOnce({ exitCode: 0, data: true });

        await lastValueFrom(service.doLaunch(buildLaunchOptions()));

        expect(config.set).toHaveBeenCalledWith("dont-remind-vr-runtime", true);
    });

    it("confirms the runtime before enabling Oculus sideloading", async () => {
        const { service, sendV2 } = buildService();
        const launchOptions = buildLaunchOptions();
        launchOptions.version.metadata = { store: BsStore.OCULUS } as any;
        launchOptions.version.oculus = false;

        await new Promise<void>((resolve, reject) => {
            service.launch(launchOptions).subscribe({ complete: resolve, error: reject });
        });

        expect(sendV2.mock.calls.map(([channel]) => channel)).toEqual([
            "vr-runtime.get-active",
            "is-oculus-sideloaded-apps-enabled",
            "enable-oculus-sideloaded-apps",
            "bs-launch.launch",
        ]);
    });

    it("allows only one runtime confirmation and launch at a time", async () => {
        const { service, sendV2, openModal } = buildService();
        let resolveModal: (value: { exitCode: number; data: boolean }) => void;
        openModal.mockImplementationOnce(() => new Promise(resolve => {
            resolveModal = resolve;
        }));

        const firstLaunch = lastValueFrom(service.doLaunch(buildLaunchOptions()));
        await Promise.resolve();
        const secondLaunch = lastValueFrom(service.doLaunch(buildLaunchOptions()));

        try {
            await expect(secondLaunch).rejects.toThrow("launch already in progress");
        } finally {
            resolveModal({ exitCode: 0, data: false });
            await firstLaunch;
        }

        expect(openModal).toHaveBeenCalledTimes(1);
        expect(sendV2.mock.calls.filter(([channel]) => channel === "bs-launch.launch")).toHaveLength(1);
    });

    it("treats canceling the runtime confirmation as a cleanly completed launch attempt", async () => {
        const { service, sendV2, openModal } = buildService();
        openModal.mockResolvedValueOnce({ exitCode: 2 });
        const launchOptions = buildLaunchOptions();

        await new Promise<void>((resolve, reject) => {
            service.doLaunch(launchOptions).subscribe({ complete: resolve, error: reject });
        });

        expect(sendV2.mock.calls.filter(([channel]) => channel === "bs-launch.launch")).toHaveLength(0);
        expect(service.versionRunning$.getValue()).toBeNull();

        await lastValueFrom(service.doLaunch(launchOptions));
        expect(sendV2.mock.calls.filter(([channel]) => channel === "bs-launch.launch")).toHaveLength(1);
    });

    it("does not continue launching after the launch subscription is canceled", async () => {
        const { service, sendV2, openModal } = buildService();
        let resolveModal: (value: { exitCode: number; data: boolean }) => void;
        openModal.mockImplementationOnce(() => new Promise(resolve => {
            resolveModal = resolve;
        }));
        const launchOptions = buildLaunchOptions();

        const subscription = service.launch(launchOptions).subscribe();
        await new Promise(resolve => { setTimeout(resolve, 0); });
        expect(service.versionRunning$.getValue()).toBe(launchOptions.version);

        subscription.unsubscribe();
        expect(service.versionRunning$.getValue()).toBeNull();
        resolveModal({ exitCode: 0, data: false });
        await new Promise(resolve => { setTimeout(resolve, 0); });

        expect(sendV2.mock.calls.filter(([channel]) => channel === "bs-launch.launch")).toHaveLength(0);
    });
});
