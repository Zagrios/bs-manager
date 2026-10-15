import { getWindowsPowerShellPath } from "main/helpers/windows-powershell.helper";

describe("getWindowsPowerShellPath", () => {
    const originalSystemRoot = process.env.SystemRoot;

    afterEach(() => {
        if (originalSystemRoot === undefined) {
            delete process.env.SystemRoot;
        } else {
            process.env.SystemRoot = originalSystemRoot;
        }
    });

    it("rejects malformed absolute SystemRoot values", () => {
        process.env.SystemRoot = "C:\\Windows\"; ignored";

        expect(() => getWindowsPowerShellPath()).toThrow("SystemRoot");
    });
});
