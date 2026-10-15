import { bsmSpawn } from "main/helpers/os.helpers";
import { spawnLaunchPlan } from "main/services/bs-launcher/launcher-ports";

jest.mock("electron", () => ({ app: { getPath: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));
jest.mock("main/helpers/os.helpers", () => ({
    BSM_LAUNCH_TOKEN_ENV: "BSMANAGER_LAUNCH_TOKEN",
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
}));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn() } }));
jest.mock("main/services/static-configuration.service", () => ({ StaticConfigurationService: { getInstance: jest.fn() } }));

beforeEach(() => {
    jest.clearAllMocks();
});

describe("spawnLaunchPlan", () => {
    it("spawns a detached shell command that ignores stdio, so it can be unrefed on quit", () => {
        spawnLaunchPlan({ cmdlet: "\"C:/Beat Saber/Beat Saber.exe\"", args: ["fpfc"], env: { FOO: "bar" } }, "C:/Beat Saber");

        expect(bsmSpawn).toHaveBeenCalledWith("\"C:/Beat Saber/Beat Saber.exe\"", {
            args: ["fpfc"],
            options: { detached: true, cwd: "C:/Beat Saber", env: { FOO: "bar" }, stdio: "ignore", shell: true },
            log: 1,
            flatpak: { host: false, env: undefined },
        });
    });

    it("keeps verbose arguments verbatim on Windows", () => {
        spawnLaunchPlan({ cmdlet: "gamemoderun", args: ["\"C:/Beat Saber/Beat Saber.exe\"", "--verbose"], env: {} }, "C:/Beat Saber");

        expect((bsmSpawn as jest.Mock).mock.calls[0][1].options.windowsVerbatimArguments).toBe(true);
    });

    it("spawns on the Flatpak host, forwarding exactly the planned env keys", () => {
        spawnLaunchPlan({
            cmdlet: "proton",
            args: [],
            env: { VR_OVERRIDE: "/games/Beat Saber/Beat Saber.exe", BSMANAGER_LAUNCH_TOKEN: "token" },
            hostEnvKeys: ["VR_OVERRIDE", "BSMANAGER_LAUNCH_TOKEN"],
        }, "/games/Beat Saber");

        expect(bsmSpawn).toHaveBeenCalledWith("proton", expect.objectContaining({
            flatpak: { host: true, env: ["VR_OVERRIDE", "BSMANAGER_LAUNCH_TOKEN"] },
        }));
    });
});
