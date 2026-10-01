import { SteamShortcut } from "shared/models/steam/shortcut.model";

describe("Steam shortcut serialization", () => {
    const launchLink = "bsmanager://launch/?version=1.45.2&desktopMode=true";

    it.each([
        `"${launchLink}"`,
        `"/home/user/BS Manager/release/app" "${launchLink}"`,
        `"run" "io.bsmanager.bsmanager" "${launchLink}"`,
    ])("preserves existing launch argument quoting when another shortcut is added: %s", launchOptions => {
        const original = new SteamShortcut({
            AppName: "Beat Saber",
            Exe: "/opt/BS Manager/bsmanager",
            StartDir: "/opt/BS Manager",
            LaunchOptions: launchOptions,
        });
        const existing = SteamShortcut.parseShortcutsRawData(SteamShortcut.getShortcutsString([original]));
        const added = new SteamShortcut({
            AppName: "Another version",
            Exe: "/opt/BS Manager/bsmanager",
            StartDir: "/opt/BS Manager",
            LaunchOptions: '"bsmanager://launch/?version=1.29.1"',
        });

        const rewritten = SteamShortcut.getShortcutsString([...existing, added]);

        expect(rewritten).toContain(`\x01LaunchOptions\x00${launchOptions}\x00`);
        expect(rewritten).toContain('\x01Exe\x00"/opt/BS Manager/bsmanager"\x00');
        expect(rewritten).toContain('\x01StartDir\x00"/opt/BS Manager"\x00');
    });

    it("preserves literal quotes in shortcut names", () => {
        const original = new SteamShortcut({
            AppName: 'Beat Saber "custom version"',
            Exe: "/opt/bsmanager",
            StartDir: "/opt",
        });

        const parsed = SteamShortcut.parseShortcutsRawData(SteamShortcut.getShortcutsString([original]));

        expect(SteamShortcut.getShortcutsString(parsed)).toContain('\x01AppName\x00Beat Saber "custom version"\x00');
    });
});
