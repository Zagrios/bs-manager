import fs from "fs";
import path from "path";

const rendererRoot = path.resolve(__dirname, "../../renderer");

function readRendererSource(relativePath: string): string {
    return fs.readFileSync(path.join(rendererRoot, relativePath), "utf8");
}

describe("Proton folder write routing", () => {
    it("routes SettingsPage persistence through LinuxService without a generic static-config write", () => {
        const source = readRendererSource("pages/settings-page.component.tsx");

        expect(source).toContain("linuxService.setProtonFolder(protonPath)");
        expect(source).not.toContain('staticConfig.set("proton-folder"');
    });

    it("keeps the setup chooser free of direct static-config persistence", () => {
        const source = readRendererSource("components/modal/modal-types/setup/choose-proton-folder-modal.component.tsx");

        expect(source).toContain("linuxService.setProtonFolder(path)");
        expect(source).not.toContain('set("proton-folder"');
    });
});
