import path from "path";
import { planPrefixCommand } from "main/services/bs-launcher/launch-plan";
import { ProtonConfig } from "main/services/bs-launcher/game-runtime";

jest.mock("electron", () => ({ app: { getPath: () => "" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

describe("BSIPA prefix Proton selection", () => {
    const gameFolder = "/games/Beat Saber";
    const ipaPath = path.join(gameFolder, "IPA.exe");
    const beatSaberExe = path.join(gameFolder, "Beat Saber.exe");
    const baseEnv = { HOME: "/home/player" };

    const mainProton: ProtonConfig = {
        protonPath: "/proton/main/proton",
        compatDataPath: "/bsm/compatdata",
        steamPath: "/home/player/.steam/steam",
        nixOS: false,
    };

    const prefixProton: ProtonConfig = {
        ...mainProton,
        protonPath: "/proton/ipa/proton",
    };

    it("builds the IPA prefix command with the selected prefix Proton", async () => {
        const plan = await planPrefixCommand(ipaPath, [`"${beatSaberExe}"`, "-n"], {
            platform: "linux",
            flatpak: false,
            baseEnv,
            getProtonConfig: async () => prefixProton,
        });

        expect(plan.command).toContain(`"/proton/ipa/proton" runinprefix`);
        expect(plan.command).not.toContain("/proton/main/proton");
        expect(plan.env).toMatchObject({
            STEAM_COMPAT_DATA_PATH: prefixProton.compatDataPath,
            STEAM_COMPAT_CLIENT_INSTALL_PATH: prefixProton.steamPath,
        });
    });

    it("keeps game runtime on the main Proton even when a prefix Proton exists", async () => {
        const { resolveGameRuntime, protonRuntime } = await import("main/services/bs-launcher/game-runtime");

        const runtime = await resolveGameRuntime({
            platform: "linux",
            getProtonConfig: async () => mainProton,
        });

        expect(runtime.runCommand(beatSaberExe)).toContain(`"/proton/main/proton" run`);
        expect(runtime.runCommand(beatSaberExe)).not.toContain("/proton/ipa/proton");
        expect(protonRuntime(prefixProton).prefixCommand(ipaPath)).toContain(`"/proton/ipa/proton" runinprefix`);
    });
});

describe("mods manager Proton wiring", () => {
    it("routes IPA prefix planning through getPrefixProtonConfig", () => {
        const source = require("fs").readFileSync(
            require("path").resolve(__dirname, "../../main/services/mods/bs-mods-manager.service.ts"),
            "utf8"
        );

        expect(source).toContain("getPrefixProtonConfig(");
        expect(source).not.toMatch(/getProtonConfig:\s*async\s*\(\)\s*=>\s*this\.linuxService\.getProtonConfig\(/);
    });
});
