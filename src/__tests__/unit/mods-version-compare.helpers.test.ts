import { getCompareModsMaps } from "shared/helpers/mods-version-compare.helpers";
import { BbmCategories, BbmFullMod, BbmModVersion, BbmPlatform, BbmStatus, BbmUserAPIResponse } from "shared/models/mods/mod.interface";

const author: BbmUserAPIResponse = {
    id: 1,
    username: "tester",
    githubId: "tester",
    sponsorUrl: "",
    displayName: "Tester",
    bio: "",
};

function createInstalledVersion(id: number, modId: number, modVersion = "1.0.0", dllPath?: string): BbmModVersion {
    return {
        id,
        modId,
        author,
        modVersion,
        platform: BbmPlatform.UniversalPC,
        zipHash: "",
        status: BbmStatus.Verified,
        dependencies: [],
        contentHashes: dllPath ? [{ path: dllPath, hash: "" }] : [],
        supportedGameVersions: [],
        downloadCount: 0,
    };
}

function createFullMod(id: number, name: string, category = BbmCategories.Core, versionId = id): BbmFullMod {
    return {
        mod: {
            id,
            name,
            summary: "",
            description: "",
            gameName: "BeatSaber",
            category,
            authors: [author],
            status: BbmStatus.Verified,
            iconFileName: "",
            gitUrl: "",
            lastApprovedById: null,
            lastUpdatedById: null,
            createdAt: new Date(0),
            updatedAt: new Date(0),
        },
        version: createInstalledVersion(versionId, id),
    };
}

describe("mods version compare helpers", () => {
    test("builds installed mods map from installed modId only", () => {
        const availableMods = [
            createFullMod(1, "Installed mod"),
            createFullMod(2, "Available only"),
        ];
        const installedMods = [createInstalledVersion(101, 1, "1.2.3")];

        const { availableModsMap, installedModsMap } = getCompareModsMaps(availableMods, installedMods);

        expect(availableModsMap.get(BbmCategories.Core).map(mod => mod.id)).toEqual([1, 2]);
        expect(installedModsMap.get(BbmCategories.Core)).toEqual([
            { id: 1, name: "Installed mod", version: "1.2.3" },
        ]);
    });

    test("preserves installed-only mods missing from the available list", () => {
        const { availableModsMap, installedModsMap } = getCompareModsMaps([], [
            createInstalledVersion(201, 999, "2.0.0", "Plugins/LocalOnly.dll"),
        ]);

        const expectedInstalledOnlyMod = { id: 999, name: "LocalOnly", version: "2.0.0" };
        expect(availableModsMap.get(BbmCategories.Other)).toEqual([expectedInstalledOnlyMod]);
        expect(installedModsMap.get(BbmCategories.Other)).toEqual([expectedInstalledOnlyMod]);
    });
});
