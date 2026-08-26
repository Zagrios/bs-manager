import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { of } from "rxjs";
import { ChooseProtonFolderModal } from "renderer/components/modal/modal-types/setup/choose-proton-folder-modal.component";

const mockChooseFolder = jest.fn();
const mockSetProtonFolder = jest.fn();
const mockStaticSet = jest.fn();
const mockNotifyError = jest.fn();

jest.mock("renderer/hooks/use-service.hook", () => ({
    useService: (Service: { getInstance: () => unknown }) => Service.getInstance(),
}));
jest.mock("renderer/hooks/use-translation.hook", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock("renderer/services/ipc.service", () => ({
    IpcService: { getInstance: () => ({ sendV2: mockChooseFolder }) },
}));
jest.mock("renderer/services/linux.service", () => ({
    LinuxService: { getInstance: () => ({ setProtonFolder: mockSetProtonFolder }) },
}));
jest.mock("renderer/services/static-configuration.service", () => ({
    StaticConfigurationService: { getInstance: () => ({ set: mockStaticSet }) },
}));
jest.mock("renderer/services/notification.service", () => ({
    NotificationService: { getInstance: () => ({ notifyError: mockNotifyError }) },
}));
jest.mock("renderer/services/modale.service", () => ({
    ModalExitCode: { COMPLETED: 0 },
}));
jest.mock("renderer/components/shared/bsm-button.component", () => {
    const ReactModule = jest.requireActual("react") as typeof React;

    return {
        BsmButton: ({ text, onClick, disabled, type }: { text: string; onClick?: () => void; disabled?: boolean; type?: string }) => ReactModule.createElement("button", { "data-text": text, disabled, onClick, type }),
    };
});

describe("ChooseProtonFolderModal", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChooseFolder.mockReturnValue(of({
            canceled: false,
            filePaths: ["/home/user/Proton"],
        }));
        mockSetProtonFolder.mockReturnValue(of(true));
        mockStaticSet.mockResolvedValue(undefined);
    });

    it("persists a chosen Proton folder through LinuxService", async () => {
        let renderer!: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(React.createElement(ChooseProtonFolderModal, {
                resolver: jest.fn(),
                options: {},
            }));
        });

        const chooseButton = renderer.root.findByProps({ "data-text": "misc.choose-folder" });
        await act(async () => {
            await chooseButton.props.onClick();
        });

        expect(mockSetProtonFolder).toHaveBeenCalledWith("/home/user/Proton");
        expect(mockStaticSet).not.toHaveBeenCalled();
        expect(renderer.root.findByProps({ "data-text": "misc.confirm" }).props.disabled).toBe(false);
        act(() => renderer.unmount());
    });

    it("keeps confirmation disabled and reports an invalid chosen folder", async () => {
        mockSetProtonFolder.mockReturnValue(of(false));
        let renderer!: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(React.createElement(ChooseProtonFolderModal, {
                resolver: jest.fn(),
                options: {},
            }));
        });

        await act(async () => {
            await renderer.root.findByProps({ "data-text": "misc.choose-folder" }).props.onClick();
        });

        expect(mockNotifyError).toHaveBeenCalledWith({
            title: "pages.settings.proton-folder.errors.title",
            desc: "pages.settings.proton-folder.errors.invalid-folder",
        });
        expect(renderer.root.findByProps({ "data-text": "misc.confirm" }).props.disabled).toBe(true);
        act(() => renderer.unmount());
    });
});
