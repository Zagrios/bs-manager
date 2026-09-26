import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { lastValueFrom } from "rxjs";
import { LocalPlaylistsManagerService } from "main/services/additional-content/local-playlists-manager.service";
import { BPList } from "shared/models/playlists/playlist.interface";

jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("main/services/bs-local-version.service", () => ({}));
jest.mock("main/services/deep-link.service", () => ({}));
jest.mock("main/services/request.service", () => ({}));
jest.mock("main/services/additional-content/maps/local-maps-manager.service", () => ({}));
jest.mock("main/services/window-manager.service", () => ({}));
jest.mock("main/services/thrid-party/beat-saver/beat-saver.service", () => ({}));
jest.mock("main/services/file-association.service", () => ({}));
jest.mock("main/services/additional-content/maps/song-details-cache.service", () => ({}));
jest.mock("main/services/installation-location.service", () => ({}));
jest.mock("main/models/archive.class", () => ({}));
jest.mock("serialize-error", () => ({ serializeError: (error: Error) => error }));

describe("LocalPlaylistsManagerService playlist installation", () => {
    let tempDirectory: string;
    let service: LocalPlaylistsManagerService;
    const playlistsBySource = new Map<string, BPList>();
    const getJSON = jest.fn(async (source: string) => ({
        data: playlistsBySource.get(source),
        headers: {},
    }));

    const playlist = (id: number): BPList => ({
        playlistTitle: "Eurobeat",
        playlistAuthor: `Creator ${id}`,
        image: "",
        customData: { syncURL: `https://api.beatsaver.com/playlists/id/${id}/download` },
        songs: [{ hash: String(id).repeat(40) }],
    });

    const download = async (bpList: BPList, dest?: string) => {
        const bplistSource = bpList.customData?.syncURL ?? "https://example.com/playlist";
        playlistsBySource.set(bplistSource, bpList);
        const result = await lastValueFrom(service.downloadPlaylist({
            bplistSource,
            ignoreSongsHashs: bpList.songs.map(song => song.hash),
            dest,
        }));
        return result.data.playlist;
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        playlistsBySource.clear();
        tempDirectory = await mkdtemp(path.join(os.tmpdir(), "bs-manager-playlists-"));
        service = Object.assign(Object.create(LocalPlaylistsManagerService.prototype), {
            PLAYLISTS_FOLDER: "Playlists",
            PLAYLIST_FILETYPES: [".bplist", ".json"],
            bsmFs: { sharedContentPath: () => tempDirectory },
            request: { getJSON, getFilenameFromContentDisposition: () => undefined },
            songDetails: { getSongDetails: () => undefined },
        });
    });

    afterEach(async () => {
        await rm(tempDirectory, { recursive: true, force: true });
    });

    it("keeps both playlists and their songs when downloads have the same filename", async () => {
        const first = await download(playlist(1));
        const second = await download(playlist(2));

        expect(second.path).not.toBe(first.path);
        expect(JSON.parse(await readFile(first.path, "utf8"))).toEqual(playlist(1));
        expect(JSON.parse(await readFile(second.path, "utf8"))).toEqual(playlist(2));
        expect(await readdir(path.dirname(first.path))).toHaveLength(2);
    });

    it("updates a colliding playlist in place even when its title and author change", async () => {
        const first = await download(playlist(1));
        const second = await download(playlist(2));
        const updated: BPList = { ...playlist(2), playlistTitle: "Renamed", playlistAuthor: "Renamed creator", songs: [] };

        const synced = await download(updated);

        expect(synced.path).toBe(second.path);
        expect(JSON.parse(await readFile(first.path, "utf8"))).toEqual(playlist(1));
        expect(JSON.parse(await readFile(second.path, "utf8"))).toEqual(updated);
        expect(await readdir(path.dirname(first.path))).toHaveLength(2);
    });

    it("updates legacy playlist filenames without creating duplicates", async () => {
        const original = playlist(1);
        const legacy = await lastValueFrom(service.writeBPListFile({ bpList: original }));
        const updated: BPList = { ...original, songs: [] };

        const synced = await download(updated);

        expect(synced.path).toBe(legacy.path);
        expect(JSON.parse(await readFile(legacy.path, "utf8"))).toEqual(updated);
        expect(await readdir(path.dirname(legacy.path))).toHaveLength(1);
    });

    it("does not identify playlists by title or author when no sync URL is available", async () => {
        const original: BPList = { ...playlist(1), customData: undefined };
        const first = await download(original);
        const updated: BPList = { ...original, songs: [] };
        const second = await download(updated);

        expect(second.path).not.toBe(first.path);
        expect(JSON.parse(await readFile(first.path, "utf8"))).toEqual(original);
        expect(JSON.parse(await readFile(second.path, "utf8"))).toEqual(updated);
    });

    it("honors an explicit destination for synchronization", async () => {
        const first = await download(playlist(1));
        const updated: BPList = { ...playlist(1), customData: undefined, songs: [] };

        const synced = await download(updated, first.path);

        expect(synced.path).toBe(first.path);
        expect(JSON.parse(await readFile(first.path, "utf8"))).toEqual(updated);
        expect(await readdir(path.dirname(first.path))).toHaveLength(1);
    });

    it("preserves malformed files that happen to use the downloaded filename", async () => {
        const original = await download(playlist(1));
        await writeFile(original.path, "broken playlist", "utf8");

        const second = await download(playlist(2));

        expect(second.path).not.toBe(original.path);
        expect(await readFile(original.path, "utf8")).toBe("broken playlist");
        expect(JSON.parse(await readFile(second.path, "utf8"))).toEqual(playlist(2));
    });

    it("keeps distinct playlists when their downloads complete concurrently", async () => {
        const [first, second] = await Promise.all([download(playlist(1)), download(playlist(2))]);

        expect(second.path).not.toBe(first.path);
        expect(JSON.parse(await readFile(first.path, "utf8"))).toEqual(playlist(1));
        expect(JSON.parse(await readFile(second.path, "utf8"))).toEqual(playlist(2));
    });

    it("keeps imported playlists with identical filenames and authors separate", async () => {
        const first = playlist(1);
        const second = { ...playlist(2), playlistAuthor: first.playlistAuthor };
        const sources: string[] = [];
        for (const [index, bpList] of [first, second].entries()) {
            const folder = path.join(tempDirectory, `import-${index}`);
            await mkdir(folder);
            const source = path.join(folder, "Eurobeat.bplist");
            await writeFile(source, JSON.stringify(bpList));
            sources.push(source);
        }

        const result = await lastValueFrom(service.importPlaylists({ paths: sources }));

        expect(result.current).toBe(2);
        const folder = path.join(tempDirectory, "Playlists");
        const files = await readdir(folder);
        expect(files).toHaveLength(2);
        const playlists = await Promise.all(files.map(async file => JSON.parse(await readFile(path.join(folder, file), "utf8"))));
        expect(playlists).toEqual(expect.arrayContaining([first, second]));
    });
});
