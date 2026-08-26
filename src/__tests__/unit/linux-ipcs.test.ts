import { lastValueFrom } from "rxjs";

const mockOn = jest.fn();
const mockSetProtonFolder = jest.fn();
const mockVerifyProtonPath = jest.fn();

jest.mock("main/services/ipc.service", () => ({
    IpcService: {
        getInstance: () => ({ on: mockOn }),
    },
}));

jest.mock("main/services/linux.service", () => ({
    LinuxService: {
        getInstance: () => ({
            setProtonFolder: mockSetProtonFolder,
            verifyProtonPath: mockVerifyProtonPath,
            getWinePrefixPath: jest.fn(),
        }),
    },
}));

describe("linux IPCs", () => {
    beforeAll(() => {
        jest.isolateModules(() => {
            require("main/ipcs/linux.ipcs");
        });
    });

    it("forwards Proton folder persistence to LinuxService", async () => {
        mockSetProtonFolder.mockResolvedValue(true);
        const handler = mockOn.mock.calls.find(([channel]) => channel === "linux.set-proton-folder")?.[1];
        const reply = jest.fn();

        expect(handler).toBeDefined();
        handler("  /home/user/Proton  ", reply);

        expect(mockSetProtonFolder).toHaveBeenCalledWith("  /home/user/Proton  ");
        await expect(lastValueFrom(reply.mock.calls[0][0])).resolves.toBe(true);
    });

    it("validates the Proton folder supplied by the renderer", () => {
        mockVerifyProtonPath.mockReturnValue(true);
        const handler = mockOn.mock.calls.find(([channel]) => channel === "linux.verify-proton-folder")[1];
        const reply = jest.fn();

        handler("/home/user/Proton", reply);

        expect(mockVerifyProtonPath).toHaveBeenCalledWith("/home/user/Proton");
        const values: boolean[] = [];
        reply.mock.calls[0][0].subscribe((value: boolean) => values.push(value));
        expect(values).toEqual([true]);
    });
});
