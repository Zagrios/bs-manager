import { lastValueFrom } from "rxjs";

const mockOn = jest.fn();
const mockSet = jest.fn();

jest.mock("main/services/ipc.service", () => ({
    IpcService: {
        getInstance: () => ({ on: mockOn }),
    },
}));
jest.mock("main/services/static-configuration.service", () => ({
    StaticConfigurationService: {
        getInstance: () => ({
            delete: jest.fn(),
            get: jest.fn(),
            set: mockSet,
        }),
    },
}));

describe("static configuration IPCs", () => {
    beforeAll(() => {
        jest.isolateModules(() => {
            require("main/ipcs/static-configuration.ipcs");
        });
    });

    it("rejects Proton folder writes through the generic setter", async () => {
        mockSet.mockResolvedValue(undefined);
        const handler = mockOn.mock.calls.find(([channel]) => channel === "static-configuration.set")[1];
        const reply = jest.fn();

        handler({ key: "proton-folder", value: "/unverified/proton" }, reply);

        expect(mockSet).not.toHaveBeenCalled();
        await expect(lastValueFrom(reply.mock.calls[0][0])).rejects.toMatchObject({
            code: "PROTON_FOLDER_WRITE_FORBIDDEN",
        });
    });
});
