import { LinuxService } from "renderer/services/linux.service";

const mockSendV2 = jest.fn();

jest.mock("renderer/services/ipc.service", () => ({
    IpcService: {
        getInstance: () => ({ sendV2: mockSendV2 }),
    },
}));

describe("renderer LinuxService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (LinuxService as unknown as { instance?: LinuxService }).instance = undefined;
    });

    it("sends the supplied Proton folder for atomic validation and persistence", () => {
        const service = LinuxService.getInstance();

        service.setProtonFolder("/home/user/Proton");

        expect(mockSendV2).toHaveBeenCalledWith("linux.set-proton-folder", "/home/user/Proton");
    });

    it("sends the supplied Proton folder for validation", () => {
        const service = LinuxService.getInstance();

        service.verifyProtonFolder("/home/user/Proton");

        expect(mockSendV2).toHaveBeenCalledWith("linux.verify-proton-folder", "/home/user/Proton");
    });
});
