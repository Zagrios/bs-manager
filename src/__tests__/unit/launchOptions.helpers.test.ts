import { parseLaunchOptions } from "main/helpers/launchOptions.helper";

const SAMPLE_EXE = "Beat Saber.exe";
const WRAPPED_EXE = `"${SAMPLE_EXE}"`

describe("Test parseLaunchOptions", () => {

    it("Empty", () => {
        const {
            env, cmdlet, args
        } = parseLaunchOptions("", { beatSaberExe: SAMPLE_EXE });
        expect(env).toEqual({});
        expect(cmdlet).toBe(WRAPPED_EXE);
        expect(args).toBe("");
    });

    it("Envs", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            `HELLO=World! DOUBLE_QUOTE="Two Words" SINGLE_QUOTE='' EMPTY=`,
            { beatSaberExe: SAMPLE_EXE }
        );
        expect(env).toEqual(expect.objectContaining({
            HELLO: "World!",
            DOUBLE_QUOTE: "Two Words",
            SINGLE_QUOTE: "",
            EMPTY: ""
        }));
        expect(cmdlet).toEqual(WRAPPED_EXE);
        expect(args).toEqual("");
    });

    it("Env with %command%", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            `TEST=TEST %command%`,
            { beatSaberExe: SAMPLE_EXE }
        );
        expect(env).toEqual(expect.objectContaining({
            TEST: "TEST",
        }));
        expect(cmdlet).toEqual(WRAPPED_EXE);
        expect(args).toEqual("");
    });

    it("Envs with arguments", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            `HELLO=World! DOUBLE_QUOTE="Two Words" SINGLE_QUOTE='' EMPTY= %command% --vr-mode`,
            { beatSaberExe: SAMPLE_EXE }
        );
        expect(env).toEqual(expect.objectContaining({
            HELLO: "World!",
            DOUBLE_QUOTE: "Two Words",
            SINGLE_QUOTE: "",
            EMPTY: ""
        }));
        expect(cmdlet).toEqual(WRAPPED_EXE);
        expect(args).toEqual("--vr-mode");
    });

    it("Linux Command 1", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            "gamemoderun %command%",
            { beatSaberExe: SAMPLE_EXE }
        );
        expect(env).toEqual({});
        expect(cmdlet).toBe("gamemoderun");
        expect(args).toBe(WRAPPED_EXE);
    });

    it("Linux Command 2", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            "mangohud %command%",
            { beatSaberExe: SAMPLE_EXE }
        );
        expect(env).toEqual({});
        expect(cmdlet).toBe("mangohud");
        expect(args).toBe(WRAPPED_EXE);
    });

    it("Linux Command 3", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            "gamescope -h 720 -H 1440 -S integer -- %command%",
            { beatSaberExe: SAMPLE_EXE }
        );
        expect(env).toEqual({});
        expect(cmdlet).toBe("gamescope");
        expect(args).toBe(`-h 720 -H 1440 -S integer -- ${WRAPPED_EXE}`);
    });

    it("Complex Linux Command", () => {
        const { env, cmdlet, args } = parseLaunchOptions(
            "WINEPREFIX=some-path HELLO=World gamescope -h 720 -H 1440 -S integer -- %command% --debug",
            { beatSaberExe: SAMPLE_EXE }
        );
        expect(env).toEqual(expect.objectContaining({
            WINEPREFIX: "some-path",
            HELLO: "World",
        }));
        expect(cmdlet).toBe("gamescope");
        expect(args).toBe(`-h 720 -H 1440 -S integer -- ${WRAPPED_EXE} --debug`);
    });

});
