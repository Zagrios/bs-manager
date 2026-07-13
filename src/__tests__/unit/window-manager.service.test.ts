import { BrowserWindow } from "electron";
import { WindowManagerService } from "main/services/window-manager.service";

const mockWindow = {
    webContents: {
        setWindowOpenHandler: jest.fn(),
        on: jest.fn(),
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

describe("WindowManagerService", () => {
    const windowManager = WindowManagerService.getInstance();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("provides enough vertical space for launch confirmation modals", async () => {
        await windowManager.openWindow("shortcut-launch.html");

        expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
            width: 600,
            height: 500,
            minWidth: 600,
            minHeight: 300,
            resizable: true,
        }));
    });

    it("keeps the privileged preload for internal application windows", async () => {
        await windowManager.openWindow("index.html");

        expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
            webPreferences: expect.objectContaining({
                preload: expect.stringContaining("preload.js"),
            }),
        }));
    });

    it("opens remote windows without a preload and with hardened preferences", async () => {
        await windowManager.openRemoteWindow("https://secure.oculus.com", {
            webPreferences: {
                preload: "untrusted-preload.js",
                nodeIntegration: true,
                contextIsolation: false,
                sandbox: false,
                webSecurity: false,
                webviewTag: true,
            },
        });

        const { webPreferences } = (BrowserWindow as unknown as jest.Mock).mock.calls[0][0];
        expect(webPreferences).not.toHaveProperty("preload");
        expect(webPreferences).toEqual(expect.objectContaining({
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            webviewTag: false,
        }));
    });

    it("rejects remote URLs passed to the privileged internal-window API", async () => {
        await expect(windowManager.openWindow("https://example.com"))
            .rejects.toThrow("Remote URLs must be opened with openRemoteWindow");

        expect(BrowserWindow).not.toHaveBeenCalled();
    });

    it("blocks an internal window from navigating to a remote page", async () => {
        await windowManager.openWindow("index.html");

        const navigationHandler = mockWindow.webContents.on.mock.calls
            .find(([event]) => event === "will-navigate")?.[1];
        const event = { preventDefault: jest.fn() };
        navigationHandler(event, "https://example.com");

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });
});
