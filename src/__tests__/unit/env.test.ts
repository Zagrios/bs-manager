import { parseEnvString } from "main/helpers/env.helpers";

describe("Test parseEnvString", () => {

    it("Empty", () => {
        const envVars = parseEnvString("");
        expect(envVars).toEqual({});
    });

    it("Single test; no quotes", () => {
        const envString = "HELLO=World!";
        const envVars = parseEnvString(envString);
        expect(envVars).toEqual({
            HELLO: "World!",
        });
    });

    it("Single test; single quotes", () => {
        const envString = "SINGLE_QOUTE='Single quote with spaces'";
        const envVars = parseEnvString(envString);
        expect(envVars).toEqual({
            SINGLE_QOUTE: "Single quote with spaces",
        });
    });

    it("Single test; double quotes", () => {
        const envString = 'DOUBLE_QOUTE="Some random quote."';
        const envVars = parseEnvString(envString);
        expect(envVars).toEqual({
            DOUBLE_QOUTE: "Some random quote.",
        });
    });

    it("Single test; empty value", () => {
        const envString = "EMPTY=";
        const envVars = parseEnvString(envString);
        expect(envVars).toEqual({
            EMPTY: "",
        });
    });

    it("Multiple test; combined", () => {
        const envString = `HELLO=World! DOUBLE_QUOTE="Two Words" SINGLE_QUOTE='' EMPTY=`
        const envVars = parseEnvString(envString);
        expect(envVars).toEqual(expect.objectContaining({
            HELLO: "World!",
            DOUBLE_QUOTE: "Two Words",
            SINGLE_QUOTE: "",
            EMPTY: ""
        }));
    });

    it("Key with numbers and lower case", () => {
        const envString = "H3ll0=world";
        const envVars = parseEnvString(envString);
        expect(envVars).toEqual({
            H3ll0: "world",
        });
    });

});
