import { parseLaunchOptions } from "main/helpers/launchOptions.helper";

const SAMPLE_EXE = `"Beat Saber.exe"`;
const PROTON_EXE = `"proton" run ${SAMPLE_EXE}`;

describe("Test parseLaunchOptions", () => {

    it("Empty", () => {
        const {
            env, cmdlet, args
        } = parseLaunchOptions("", { commandReplacement: SAMPLE_EXE });
        expect(env).toEqual({});
        expect(cmdlet).toBe(SAMPLE_EXE);
        expect(args).toBe("");
    });

    it("Envs", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            `HELLO=World! DOUBLE_QUOTE="Two Words" SINGLE_QUOTE='' EMPTY=`,
            { commandReplacement: SAMPLE_EXE }
        );
        expect(env).toEqual(expect.objectContaining({
            HELLO: "World!",
            DOUBLE_QUOTE: "Two Words",
            SINGLE_QUOTE: "",
            EMPTY: ""
        }));
        expect(cmdlet).toEqual(SAMPLE_EXE);
        expect(args).toEqual("");
    });

    it("Env with %command%", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            `TEST=TEST %command%`,
            { commandReplacement: SAMPLE_EXE }
        );
        expect(env).toEqual(expect.objectContaining({
            TEST: "TEST",
        }));
        expect(cmdlet).toEqual(SAMPLE_EXE);
        expect(args).toEqual("");
    });

    it("Envs with arguments", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            `HELLO=World! DOUBLE_QUOTE="Two Words" SINGLE_QUOTE='' EMPTY= %command% --vr-mode`,
            { commandReplacement: SAMPLE_EXE }
        );
        expect(env).toEqual(expect.objectContaining({
            HELLO: "World!",
            DOUBLE_QUOTE: "Two Words",
            SINGLE_QUOTE: "",
            EMPTY: ""
        }));
        expect(cmdlet).toEqual(SAMPLE_EXE);
        expect(args).toEqual("--vr-mode");
    });

    it("Linux Command 1", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            "gamemoderun %command%",
            { commandReplacement: PROTON_EXE }
        );
        expect(env).toEqual({});
        expect(cmdlet).toBe("gamemoderun");
        expect(args).toBe(PROTON_EXE);
    });

    it("Linux Command 2", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            "mangohud %command%",
            { commandReplacement: PROTON_EXE }
        );
        expect(env).toEqual({});
        expect(cmdlet).toBe("mangohud");
        expect(args).toBe(PROTON_EXE);
    });

    it("Linux Command 3", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            "gamescope -h 720 -H 1440 -S integer -- %command%",
            { commandReplacement: PROTON_EXE }
        );
        expect(env).toEqual({});
        expect(cmdlet).toBe("gamescope");
        expect(args).toBe(`-h 720 -H 1440 -S integer -- ${PROTON_EXE}`);
    });

    it("Linux Command 4", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            `LD_PRELOAD="" gamescope --hdr-enabled -f -h 1440 -r 144 --force-grab-cursor --framerate-limit 144 --mangoapp -- %command%`,
            { commandReplacement: PROTON_EXE }
        );
        expect(env).toEqual({
            LD_PRELOAD: ""
        });
        expect(cmdlet).toBe("gamescope");
        expect(args).toBe(`--hdr-enabled -f -h 1440 -r 144 --force-grab-cursor --framerate-limit 144 --mangoapp -- ${PROTON_EXE}`);
    });

    it("Complex Linux Command", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            "WINEPREFIX=some-path HELLO=World gamescope -h 720 -H 1440 -S integer -- %command% --debug",
            { commandReplacement: PROTON_EXE }
        );
        expect(env).toEqual(expect.objectContaining({
            WINEPREFIX: "some-path",
            HELLO: "World",
        }));
        expect(cmdlet).toBe("gamescope");
        expect(args).toBe(`-h 720 -H 1440 -S integer -- ${PROTON_EXE} --debug`);
    });

});
