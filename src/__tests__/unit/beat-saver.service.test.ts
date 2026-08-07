import log from "electron-log";
import { BeatSaverService } from "main/services/thrid-party/beat-saver/beat-saver.service";
import { BsvMapDetail } from "shared/models/maps";
import { BsvSearchOrder, SearchParams } from "shared/models/maps/beat-saver.model";

jest.mock("electron-log", () => ({
    error: jest.fn(),
}));

jest.mock("main/services/thrid-party/beat-saver/beat-saver-api.service", () => ({
    BeatSaverApiService: { getInstance: jest.fn(() => ({})) },
}));

describe("BeatSaverService.searchMaps", () => {
    const map = { id: "5346e" } as BsvMapDetail;
    const search: SearchParams = {
        sortOrder: BsvSearchOrder.Relevance,
        page: 0,
        q: "!bsr 5346e",
    };
    const regularSearch: SearchParams = {
        ...search,
        q: "Jinsei Matatabi",
    };

    function buildService() {
        const bsaverApi = {
            searchMaps: jest.fn(),
            getMapDetailsById: jest.fn(),
        };
        const service = Object.create(BeatSaverService.prototype) as BeatSaverService;
        Object.assign(service as any, { bsaverApi });

        return { service, bsaverApi };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns maps from a regular search response", async () => {
        const { service, bsaverApi } = buildService();
        bsaverApi.searchMaps.mockResolvedValue({ docs: [map] });

        await expect(service.searchMaps(regularSearch)).resolves.toEqual([map]);
        expect(bsaverApi.getMapDetailsById).not.toHaveBeenCalled();
    });

    it("parses a BSR code without calling the search endpoint", async () => {
        const { service, bsaverApi } = buildService();
        bsaverApi.getMapDetailsById.mockResolvedValue(map);

        await expect(service.searchMaps(search)).resolves.toEqual([map]);
        expect(bsaverApi.searchMaps).not.toHaveBeenCalled();
        expect(bsaverApi.getMapDetailsById).toHaveBeenCalledTimes(1);
        expect(bsaverApi.getMapDetailsById).toHaveBeenCalledWith(map.id);
    });

    it("still resolves redirect responses from the search endpoint", async () => {
        const { service, bsaverApi } = buildService();
        bsaverApi.searchMaps.mockResolvedValue({ redirect: map.id });
        bsaverApi.getMapDetailsById.mockResolvedValue(map);

        await expect(service.searchMaps(regularSearch)).resolves.toEqual([map]);
        expect(bsaverApi.getMapDetailsById).toHaveBeenCalledWith(map.id);
    });

    it("does not load or duplicate a BSR result on later search pages", async () => {
        const { service, bsaverApi } = buildService();

        await expect(service.searchMaps({ ...search, page: 1 })).resolves.toEqual([]);
        expect(bsaverApi.searchMaps).not.toHaveBeenCalled();
        expect(bsaverApi.getMapDetailsById).not.toHaveBeenCalled();
    });

    it("does not duplicate a redirect result on later search pages", async () => {
        const { service, bsaverApi } = buildService();
        bsaverApi.searchMaps.mockResolvedValue({ redirect: map.id });

        await expect(service.searchMaps({ ...regularSearch, page: 1 })).resolves.toEqual([]);
        expect(bsaverApi.getMapDetailsById).not.toHaveBeenCalled();
    });

    it("returns an empty result when the BeatSaver request fails", async () => {
        const { service, bsaverApi } = buildService();
        const error = new Error("BeatSaver unavailable");
        bsaverApi.searchMaps.mockRejectedValue(error);

        await expect(service.searchMaps(regularSearch)).resolves.toEqual([]);
        expect(log.error).toHaveBeenCalledWith(error);
    });
});
