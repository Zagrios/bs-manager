import path from "path";
import { LaunchContext, LaunchPlan, LaunchRequest, planLaunch, planPrefixCommand, withLaunchToken } from "main/services/bs-launcher/launch-plan";
import { ProtonConfig } from "main/services/bs-launcher/game-runtime";
import { BSM_LAUNCH_TOKEN_ENV } from "main/helpers/os.helpers";
import { LaunchOption } from "shared/models/bs-launch";

jest.mock("electron", () => ({ app: { getPath: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const GAME_FOLDER = "/games/Beat Saber";
const EXE = path.join(GAME_FOLDER, "Beat Saber.exe");
const BASE_ENV = { HOME: "/home/player", DXVK_HUD: "0" };
const STEAM_IDS = { SteamAppId: "620980", SteamOverlayGameId: "620980", SteamGameId: "620980" };
const FPFC_ENV = { VR_OVERRIDE: EXE, XR_RUNTIME_JSON: path.join(EXE, "disabled-openxr.json") };
const PROTON: ProtonConfig = {
    protonPath: "/proton/proton",
    compatDataPath: "/bsm/compatdata",
    steamPath: "/home/player/.steam/steam",
    nixOS: false,
};
const PROTON_ENV = {
    WINEDLLOVERRIDES: "winhttp=n,b",
    STEAM_COMPAT_DATA_PATH: PROTON.compatDataPath,
    STEAM_COMPAT_INSTALL_PATH: GAME_FOLDER,
    STEAM_COMPAT_CLIENT_INSTALL_PATH: PROTON.steamPath,
    STEAM_COMPAT_APP_ID: "620980",
    SteamEnv: "1",
    OXR_NO_TEXTURE_SOURCE_ALPHA: "1",
};

type Machine = { platform: NodeJS.Platform; flatpak?: boolean; proton?: ProtonConfig };

function context({ platform, flatpak = false, proton = PROTON }: Machine): LaunchContext {
    return {
        platform,
        flatpak,
        baseEnv: { ...BASE_ENV },
        getProtonConfig: async () => {
            if (platform !== "linux") {
                throw new Error("Proton must not be resolved off Linux");
            }
            return proton;
        },
    };
}

function request(launchOptions: Omit<LaunchOption, "version">, store: LaunchRequest["store"] = "steam"): LaunchRequest {
    return {
        store,
        gameFolder: GAME_FOLDER,
        launchOptions: { version: { BSVersion: "1.40.0", steam: store === "steam", oculus: store === "oculus" }, ...launchOptions },
    };
}

describe("planLaunch", () => {
    it.each<{ name: string; machine: Machine; request: LaunchRequest; plan: LaunchPlan }>([
        {
            name: "Windows, plain Steam launch",
            machine: { platform: "win32" },
            request: request({}),
            plan: { cmdlet: `"${EXE}"`, args: [], env: { ...BASE_ENV, ...STEAM_IDS } },
        },
        {
            name: "Windows, launch mods, user env/args and admin",
            machine: { platform: "win32" },
            request: request({
                launchMods: ["fpfc", "debug"],
                command: "FOO=bar DXVK_HUD=1 %command% --extra",
                admin: true,
            }),
            plan: {
                cmdlet: `"${EXE}"`,
                args: ["--extra", "fpfc", "--verbose", "-vrmode", "None"],
                env: { ...BASE_ENV, ...STEAM_IDS, FOO: "bar", DXVK_HUD: "1", ...FPFC_ENV },
                elevated: { exePath: EXE, args: ["fpfc", "--verbose", "-vrmode", "None"] },
            },
        },
        {
            name: "Windows, FPFC suppression wins over a user selected VR runtime",
            machine: { platform: "win32" },
            request: request({ launchMods: ["fpfc"], command: "VR_OVERRIDE=C:/SteamVR XR_RUNTIME_JSON=C:/SteamVR/steamxr.json" }),
            plan: { cmdlet: `"${EXE}"`, args: ["fpfc", "-vrmode", "None"], env: { ...BASE_ENV, ...STEAM_IDS, ...FPFC_ENV } },
        },
        {
            name: "Windows, FPFC with the Oculus runtime keeps the user VR runtime",
            machine: { platform: "win32" },
            request: request({ launchMods: ["fpfc", "oculus"], command: "VR_OVERRIDE=C:/OpenComposite" }),
            plan: {
                cmdlet: `"${EXE}"`,
                args: ["-vrmode", "oculus", "fpfc"],
                env: { ...BASE_ENV, ...STEAM_IDS, VR_OVERRIDE: "C:/OpenComposite" },
            },
        },
        {
            name: "Oculus store, never Proton, no Steam ids, no FPFC suppression, no elevation",
            machine: { platform: "linux" },
            request: request({ launchMods: ["fpfc"], command: "FOO=bar %command%", admin: true }, "oculus"),
            plan: { cmdlet: `"${EXE}"`, args: ["fpfc"], env: { ...BASE_ENV, FOO: "bar" } },
        },
        {
            name: "Linux, Proton compat env and admin dropped",
            machine: { platform: "linux" },
            request: request({ admin: true }),
            plan: {
                cmdlet: `"/proton/proton" run "${EXE}"`,
                args: [],
                env: { ...BASE_ENV, ...STEAM_IDS, ...PROTON_ENV },
            },
        },
        {
            name: "Linux, user wrapper around %command% with Proton logs and parallel views",
            machine: { platform: "linux" },
            request: request({
                launchMods: ["proton_logs", "parallel_views", "fpfc"],
                command: "WINEDLLOVERRIDES=dxgi=n gamemoderun %command% -screen-fullscreen 0",
            }),
            plan: {
                cmdlet: "gamemoderun",
                args: [`"/proton/proton" run "${EXE}" -screen-fullscreen 0`, "fpfc", "-vrmode", "None"],
                env: {
                    ...BASE_ENV, ...STEAM_IDS, ...PROTON_ENV,
                    WINEDLLOVERRIDES: "dxgi=n",
                    PROTON_LOG: "1",
                    PROTON_LOG_DIR: path.join(GAME_FOLDER, "Logs"),
                    OXR_PARALLEL_VIEWS: "1",
                    ...FPFC_ENV,
                },
            },
        },
        {
            name: "Linux, NixOS wraps Proton in steam-run",
            machine: { platform: "linux", proton: { ...PROTON, nixOS: true } },
            request: request({}),
            plan: {
                cmdlet: `steam-run "/proton/proton" run "${EXE}"`,
                args: [],
                env: { ...BASE_ENV, ...STEAM_IDS, ...PROTON_ENV },
            },
        },
    ])("$name", async ({ machine, request: launchRequest, plan }) => {
        await expect(planLaunch(launchRequest, context(machine))).resolves.toEqual(plan);
    });

    it.each<{ name: string; machine: Machine; request: LaunchRequest; forwarded: string[] }>([
        {
            name: "Proton launch",
            machine: { platform: "linux", flatpak: true },
            request: request({ launchMods: ["fpfc", "proton_logs", "parallel_views"], command: "DXVK_HUD=1 MANGOHUD=1 %command%" }),
            forwarded: [
                ...Object.keys(STEAM_IDS), ...Object.keys(PROTON_ENV), ...Object.keys(FPFC_ENV),
                "PROTON_LOG", "PROTON_LOG_DIR", "OXR_PARALLEL_VIEWS", "DXVK_HUD", "MANGOHUD",
            ],
        },
        {
            name: "Oculus launch",
            machine: { platform: "linux", flatpak: true },
            request: request({ command: "DXVK_HUD=1" }, "oculus"),
            forwarded: ["DXVK_HUD"],
        },
    ])("forwards every env key the plan produced to the Flatpak host ($name)", async ({ machine, request: launchRequest, forwarded }) => {
        const plan = withLaunchToken(await planLaunch(launchRequest, context(machine)), "token");

        expect([...plan.hostEnvKeys].sort()).toEqual([...forwarded, BSM_LAUNCH_TOKEN_ENV].sort());
        const changedKeys = Object.keys(plan.env).filter(key => plan.env[key] !== (BASE_ENV as Record<string, string>)[key]);
        expect(plan.hostEnvKeys).toEqual(expect.arrayContaining(changedKeys));
        expect(plan.env[BSM_LAUNCH_TOKEN_ENV]).toBe("token");
    });

    it("forwards game-related keys set on the Flatpak sandbox itself", async () => {
        const flatpakContext = { ...context({ platform: "linux", flatpak: true }), baseEnv: { ...BASE_ENV, PROTON_LOG: "1", XR_RUNTIME_JSON: "/host/openxr.json" } };
        const plan = await planLaunch(request({}), flatpakContext);

        expect(plan.hostEnvKeys).toEqual(expect.arrayContaining(["PROTON_LOG", "XR_RUNTIME_JSON"]));
        expect(plan.hostEnvKeys).not.toContain("PROTON_LOG_DIR");
    });

    it("spawns locally outside Flatpak", async () => {
        const plan = withLaunchToken(await planLaunch(request({}), context({ platform: "linux" })), "token");

        expect(plan.hostEnvKeys).toBeUndefined();
        expect(plan.env[BSM_LAUNCH_TOKEN_ENV]).toBe("token");
    });

    it("leaves a plan untouched without a launch token", async () => {
        const plan = await planLaunch(request({}), context({ platform: "linux", flatpak: true }));

        expect(withLaunchToken(plan, undefined)).toBe(plan);
    });

    it("fails when Proton cannot be resolved on Linux", async () => {
        const failing: LaunchContext = {
            ...context({ platform: "linux" }),
            getProtonConfig: () => Promise.reject(new Error("Proton folder not set")),
        };

        await expect(planLaunch(request({}), failing)).rejects.toThrow("Proton folder not set");
        await expect(planLaunch(request({}), { ...failing, getProtonConfig: undefined })).rejects.toThrow("Proton configuration is required");
    });
});

describe("planPrefixCommand", () => {
    const IPA = path.join(GAME_FOLDER, "IPA.exe");
    const PREFIX_ENV = {
        STEAM_COMPAT_DATA_PATH: PROTON.compatDataPath,
        STEAM_COMPAT_CLIENT_INSTALL_PATH: PROTON.steamPath,
    };

    it.each<{ name: string; machine: Machine; command: string; env: Record<string, string>; hostEnvKeys?: string[] }>([
        {
            name: "Windows",
            machine: { platform: "win32" },
            command: `"${IPA}" "${EXE}" -n`,
            env: BASE_ENV,
        },
        {
            name: "Linux",
            machine: { platform: "linux" },
            command: `"/proton/proton" runinprefix "${IPA}" "${EXE}" -n`,
            env: { ...BASE_ENV, ...PREFIX_ENV },
        },
        {
            name: "NixOS under Flatpak",
            machine: { platform: "linux", flatpak: true, proton: { ...PROTON, nixOS: true } },
            command: `steam-run "/proton/proton" runinprefix "${IPA}" "${EXE}" -n`,
            env: { ...BASE_ENV, ...PREFIX_ENV },
            hostEnvKeys: Object.keys(PREFIX_ENV),
        },
    ])("$name", async ({ machine, command, env, hostEnvKeys }) => {
        await expect(planPrefixCommand(IPA, [`"${EXE}"`, "-n"], context(machine))).resolves.toEqual({ command, env, hostEnvKeys });
    });
});
