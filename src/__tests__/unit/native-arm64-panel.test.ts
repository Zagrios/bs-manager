import { BsArm64Status, BsArm64Unsupported } from "shared/models/bs-arm64/bs-arm64.model";

jest.mock("renderer", () => ({ logRenderError: jest.fn() }));
jest.mock("renderer/services/bs-arm64.service", () => ({ BsArm64Service: { getInstance: jest.fn() } }));
jest.mock("renderer/services/notification.service", () => ({ NotificationService: { getInstance: jest.fn() } }));
jest.mock("renderer/hooks/use-translation.hook", () => ({ useTranslationV2: () => ({ text: (key: string) => key }) }));
jest.mock("renderer/hooks/use-service.hook", () => ({ useService: jest.fn() }));
jest.mock("renderer/components/shared/bsm-button.component", () => ({ BsmButton: () => null }));
jest.mock("renderer/components/shared/bsm-link.component", () => ({ BsmLink: () => null }));
jest.mock("renderer/components/shared/toogle-switch.component", () => ({ ToogleSwitch: () => null }));
jest.mock("@tippyjs/react", () => ({ __esModule: true, default: () => null }));

const { nativeArm64StateKey } = require(
    "renderer/components/version-viewer/slides/launch/native-arm64-panel.component"
) as typeof import("renderer/components/version-viewer/slides/launch/native-arm64-panel.component");

function status(overrides: Partial<BsArm64Status> = {}): BsArm64Status {
    return { installed: false, mods: false, ready: false, native: true, ...overrides };
}

describe("nativeArm64StateKey", () => {
    it("says a version that's on runs natively once it's installed and ready", () => {
        expect(nativeArm64StateKey(status({ installed: true, ready: true }))).toBe("state.on-ready");
    });

    it("says a version that's on gets set up at the next launch otherwise", () => {
        expect(nativeArm64StateKey(status())).toBe("state.on-pending");
        // Proton updated since the install
        expect(nativeArm64StateKey(status({ installed: true, ready: false }))).toBe("state.on-pending");
    });

    it("says a version that's off runs through emulation", () => {
        expect(nativeArm64StateKey(status({ native: false }))).toBe("state.off");
    });

    it("explains why the native build can't be used", () => {
        expect(nativeArm64StateKey(status({ unsupported: BsArm64Unsupported.NO_RELEASE }))).toBe("unsupported.NO_RELEASE");
        expect(nativeArm64StateKey(status({ native: false, unsupported: BsArm64Unsupported.VERSION_NOT_SUPPORTED }))).toBe("unsupported.VERSION_NOT_SUPPORTED");
    });

    it("shows what's happening while installing or removing", () => {
        expect(nativeArm64StateKey(status(), "install")).toBe("state.installing");
        expect(nativeArm64StateKey(status({ installed: true }), "uninstall")).toBe("state.removing");
    });
});
