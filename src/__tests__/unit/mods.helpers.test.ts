import { parseMetadata } from "main/helpers/mods.helpers";
import path from "path";

const TEST_FOLDER = path.resolve(__dirname, "..", "assets", "dll");

describe("Test mods.helpers.test", () => {

    test("parseMetadata of BSML.dll", async () => {
        const filepath = path.join(TEST_FOLDER, "BSML.dll");
        const data = await parseMetadata(filepath);

        expect(data).toBeTruthy();

        expect(data.name).toBe("BeatSaberMarkupLanguage");
        expect(data.id).toBe("BeatSaberMarkupLanguage");
        expect(data.author).toBeTruthy();
        expect(data.version).toBeTruthy();
        expect(data.gameVersion).toBeTruthy();
    });

    test("parseMetadata of Bugsmash.dll", async () => {
        const filepath = path.join(TEST_FOLDER, "Bugsmash.dll");
        const data = await parseMetadata(filepath);

        expect(data).toBeTruthy();

        expect(data.name).toBe("Bugsmash");
        expect(data.id).toBe("Bugsmash");
        expect(data.author).toBeTruthy();
        expect(data.version).toBeTruthy();
        expect(data.gameVersion).toBeTruthy();
    });

    test("parseMetadata of PlaylistManager.dll", async () => {
        const filepath = path.join(TEST_FOLDER, "PlaylistManager.dll");
        const data = await parseMetadata(filepath);

        expect(data).toBeTruthy();

        expect(data.name).toBe("PlaylistManager");
        expect(data.id).toBe("PlaylistManager");
        expect(data.author).toBeTruthy();
        expect(data.version).toBeTruthy();
        expect(data.gameVersion).toBeTruthy();

    });

    test("parseMetadata of SongCore.dll", async () => {
        const filepath = path.join(TEST_FOLDER, "SongCore.dll");
        const data = await parseMetadata(filepath);

        expect(data).toBeTruthy();

        expect(data.name).toBe("SongCore");
        expect(data.id).toBe("SongCore");
        expect(data.author).toBeTruthy();
        expect(data.version).toBeTruthy();
        expect(data.gameVersion).toBeTruthy();
    });

});

