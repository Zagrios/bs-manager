import path from "path";
import { app } from "electron";
import { buildLinuxDesktopEntry, buildSteamShortcutData } from "main/helpers/launch-shortcut.helpers";

jest.mock("electron", () => ({
    app: {
        getPath: jest.fn(() => "/opt/BS Manager/bsmanager"),
        getAppPath: jest.fn(() => "/home/user/BS Manager/release/app"),
    },
}));
jest.mock("main/constants", () => ({
    get IS_FLATPAK() { return process.env.container === "flatpak"; },
}));

describe("BSManager shortcut targets", () => {
    const originalEnv = process.env;
    const originalPlatform = process.platform;
    const originalDefaultApp = Object.getOwnPropertyDescriptor(process, "defaultApp");
    const launchLink = "bsmanager://launch/?version=1.45.2&versionName=My+version&command=gamescope+%25command%25&desktopMode=true";

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.APPIMAGE;
        delete process.env.FLATPAK_ID;
        delete process.env.FLATPAK_BINARY;
        delete process.env.container;
        Object.defineProperty(process, "platform", { value: "linux" });
        Object.defineProperty(process, "defaultApp", { value: false, configurable: true, writable: true });
        (app.getPath as jest.Mock).mockReturnValue("/opt/BS Manager/bsmanager");
    });

    afterEach(() => {
        process.env = originalEnv;
        Object.defineProperty(process, "platform", { value: originalPlatform });
        if (originalDefaultApp) {
            Object.defineProperty(process, "defaultApp", originalDefaultApp);
        } else {
            Reflect.deleteProperty(process, "defaultApp");
        }
    });

    it.each(["linux", "win32"])("starts BSManager with the complete launch link from Steam on %s", platform => {
        Object.defineProperty(process, "platform", { value: platform });

        expect(buildSteamShortcutData("Beat Saber", "/icon.png", launchLink)).toEqual({
            AppName: "Beat Saber",
            Exe: "/opt/BS Manager/bsmanager",
            StartDir: path.dirname("/opt/BS Manager/bsmanager"),
            icon: "/icon.png",
            OpenVR: "\x01",
            LaunchOptions: `"${launchLink}"`,
        });
    });

    it("quotes native desktop commands and preserves percent-encoded launch options", () => {
        const desktopEntry = buildLinuxDesktopEntry("Beat Saber", "/icon.png", launchLink);

        expect(desktopEntry).toContain(
            'Exec="/opt/BS Manager/bsmanager" "bsmanager://launch/?version=1.45.2&versionName=My+version&command=gamescope+%%25command%%25&desktopMode=true"'
        );
    });

    it("uses the host Flatpak launcher and app ID for Steam and desktop shortcuts", () => {
        process.env.container = "flatpak";
        process.env.FLATPAK_ID = "io.bsmanager.bsmanager";
        (app.getPath as jest.Mock).mockReturnValue("/app/bin/bsmanager");

        expect(buildSteamShortcutData("Beat Saber", "/icon.png", launchLink)).toEqual(expect.objectContaining({
            Exe: "/usr/bin/flatpak",
            StartDir: "/",
            LaunchOptions: `"run" "io.bsmanager.bsmanager" "${launchLink}"`,
        }));
        expect(buildLinuxDesktopEntry("Beat Saber", "/icon.png", launchLink)).toContain(
            'Exec="/usr/bin/flatpak" "run" "io.bsmanager.bsmanager" "bsmanager://launch/?version=1.45.2&versionName=My+version&command=gamescope+%%25command%%25&desktopMode=true"'
        );
    });

    it("supports a custom Flatpak installation ID and host binary", () => {
        process.env.container = "flatpak";
        process.env.FLATPAK_ID = "io.bsmanager.bsmanager.Devel";
        process.env.FLATPAK_BINARY = "/custom/bin/flatpak";

        expect(buildSteamShortcutData("Beat Saber", "/icon.png", launchLink)).toEqual(expect.objectContaining({
            Exe: "/custom/bin/flatpak",
            LaunchOptions: `"run" "io.bsmanager.bsmanager.Devel" "${launchLink}"`,
        }));
    });

    it("uses the packaged app ID when Flatpak does not expose it", () => {
        process.env.container = "flatpak";

        expect(buildSteamShortcutData("Beat Saber", "/icon.png", launchLink).LaunchOptions)
            .toBe(`"run" "io.bsmanager.bsmanager" "${launchLink}"`);
    });

    it("stores the persistent AppImage path instead of its temporary mount", () => {
        process.env.APPIMAGE = "/home/user/Applications/BS Manager.AppImage";
        (app.getPath as jest.Mock).mockReturnValue("/tmp/.mount_bsmanager/bsmanager");

        expect(buildSteamShortcutData("Beat Saber", "/icon.png", launchLink)).toEqual(expect.objectContaining({
            Exe: process.env.APPIMAGE,
            StartDir: path.dirname(process.env.APPIMAGE),
            LaunchOptions: `"${launchLink}"`,
        }));
        expect(buildLinuxDesktopEntry("Beat Saber", "/icon.png", launchLink)).toContain(
            'Exec="/home/user/Applications/BS Manager.AppImage" "bsmanager://launch/'
        );
    });

    it("includes the application entry point when running from Electron in development", () => {
        Object.defineProperty(process, "defaultApp", { value: true });

        expect(buildSteamShortcutData("Beat Saber", "/icon.png", launchLink).LaunchOptions)
            .toBe(`"/home/user/BS Manager/release/app" "${launchLink}"`);
        expect(buildLinuxDesktopEntry("Beat Saber", "/icon.png", launchLink)).toContain(
            'Exec="/opt/BS Manager/bsmanager" "/home/user/BS Manager/release/app" "bsmanager://launch/'
        );
    });

    it("escapes newlines in desktop metadata", () => {
        const desktopEntry = buildLinuxDesktopEntry("Beat Saber\nOther", "/icon.png", launchLink);

        expect(desktopEntry).toContain("Name=Beat Saber\\nOther\n");
        expect(desktopEntry).not.toContain("\nOther\n");
    });

    it("lets desktop launchers resolve executable paths containing a percent sign", () => {
        (app.getPath as jest.Mock).mockReturnValue("/home/user/100%/bsmanager");

        expect(buildLinuxDesktopEntry("Beat Saber", "/icon.png", launchLink)).toContain(
            'Exec="/usr/bin/env" "/home/user/100%%/bsmanager" "bsmanager://launch/'
        );
    });
});
