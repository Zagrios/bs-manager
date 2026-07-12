import { BrowserWindow } from "electron";
import { WindowManagerService } from "main/services/window-manager.service";

const mockWindow = {
    webContents: {
        setWindowOpenHandler: jest.fn(),
        getURL: jest.fn(() => ""),
    },
    removeMenu: jest.fn(),
    setMenu: jest.fn(),
    loadURL: jest.fn().mockResolvedValue(undefined),
    once: jest.fn((_event: string, callback: () => void) => callback()),
    show: jest.fn(),
};

jest.mock("electron", () => ({
    app: { getPath: jest.fn(() => ""), isPackaged: false },
    BrowserWindow: Object.assign(jest.fn(() => mockWindow), { getAllWindows: jest.fn((): unknown[] => []) }),
    shell: { openExternal: jest.fn() },
}));
jest.mock("main/services/utils.service", () => ({
    UtilsService: { getInstance: jest.fn(() => ({ getBuildPath: jest.fn((path: string) => path) })) },
}));

describe("WindowManagerService shortcut launch window", () => {
    it("provides enough vertical space for launch confirmation modals", async () => {
        await WindowManagerService.getInstance().openWindow("shortcut-launch.html");

        expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
            width: 600,
            height: 500,
            minWidth: 600,
            minHeight: 300,
            resizable: true,
        }));
    });
});
