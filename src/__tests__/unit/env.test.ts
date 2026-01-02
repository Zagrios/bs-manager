import { parseEnvString } from "main/helpers/env.helpers";

describe("Test parseEnvString", () => {

    it("Empty", () => {
        const { env, command } = parseEnvString("");
        expect(env).toEqual({});
        expect(command).toEqual("");
    });

    it("Single test; no quotes", () => {
        const envString = "HELLO=World!";
        const { env, command } = parseEnvString(envString);
        expect(env).toEqual({
            HELLO: "World!",
        });
        expect(command).toEqual("");
    });

    it("Single test; single quotes", () => {
        const envString = "SINGLE_QOUTE='Single quote with spaces'";
        const { env, command } = parseEnvString(envString);
        expect(env).toEqual({
            SINGLE_QOUTE: "Single quote with spaces",
        });
        expect(command).toEqual("");
    });

    it("Single test; double quotes", () => {
        const envString = 'DOUBLE_QOUTE="Some random quote."';
        const { env, command } = parseEnvString(envString);
        expect(env).toEqual({
            DOUBLE_QOUTE: "Some random quote.",
        });
        expect(command).toEqual("");
    });

    it("Single test; empty value", () => {
        const envString = "EMPTY=";
        const { env, command } = parseEnvString(envString);
        expect(env).toEqual({
            EMPTY: "",
        });
        expect(command).toEqual("");
    });

    it("Multiple test; combined", () => {
        const envString = `HELLO=World! DOUBLE_QUOTE="Two Words" SINGLE_QUOTE='' EMPTY=`
        const { env, command } = parseEnvString(envString);
        expect(env).toEqual(expect.objectContaining({
            HELLO: "World!",
            DOUBLE_QUOTE: "Two Words",
            SINGLE_QUOTE: "",
            EMPTY: ""
        }));
        expect(command).toEqual("");
    });

    it("Key with numbers and lower case", () => {
        const envString = "H3ll0=world";
        const { env, command } = parseEnvString(envString);
        expect(env).toEqual({
            H3ll0: "world",
        });
        expect(command).toEqual("");
    });

    it("Simple command", () => {
        const { env, command } = parseEnvString("some-command");
        expect(env).toEqual({});
        expect(command).toBe("some-command");
    });

    it("Env with command", () => {
        const { env, command } = parseEnvString("SAMPLE=value some-command");
        expect(env).toEqual(expect.objectContaining({
            SAMPLE: "value"
        }));
        expect(command).toBe("some-command");
    });

    it("Complex with %command%", () => {
        const envString = "KEY=value  gamescope -h 720 -H 1440 -S integer -- %command% ";
        const { env, command } = parseEnvString(envString);
        expect(env).toEqual(expect.objectContaining({
            KEY: "value"
        }));
        expect(command).toBe("gamescope -h 720 -H 1440 -S integer -- %command%");
    })

});
