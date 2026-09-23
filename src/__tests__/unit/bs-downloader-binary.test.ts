import { spawn, execFileSync } from "child_process";
import path from "path";

const executable = path.resolve("assets/scripts", process.platform === "win32" ? "bs-downloader.exe" : "bs-downloader");

describe("packaged bs-downloader protocol", () => {
    it("starts the native binary with the expected protocol", () => {
        expect(execFileSync(executable, ["--version"], { encoding: "utf8", timeout: 5000 })).toContain("protocol 1");
    });

    it.each([
        { app: 620980, manifest: "12345678901234567890", expected: "InvalidCredentials" },
        { app: 1, manifest: "12345678901234567890", expected: "InvalidManifest" },
        { app: 620980, manifest: "18446744073709551616", expected: "InvalidManifest" },
    ])("returns $expected without network access or false success", async ({ app, manifest, expected }) => {
        const child = spawn(executable, [], { windowsHide: true });
        const timer = setTimeout(() => child.kill(), 5000);
        const output: Buffer[] = [];
        child.stdout.on("data", data => output.push(data));
        child.stderr.resume();
        const closed = new Promise<number>((resolve, reject) => {
            child.on("error", reject);
            child.on("close", code => { resolve(code); });
        });
        child.stdin.write(`${JSON.stringify({ command: "start", version: 1, options: { app, depot: 620981, manifest, directory: path.resolve("test-installation") } })}\n`);
        try {
            expect(await closed).toBe(1);
            const events = Buffer.concat(output).toString().trim().split("\n").map(line => JSON.parse(line));
            expect(events).toContainEqual({ version: 1, type: "Error", subType: expected, data: "" });
            expect(events.some(event => event.subType === "Finished")).toBe(false);
        } finally {
            clearTimeout(timer);
            child.stdin.destroy();
            child.kill();
        }
    });
});
