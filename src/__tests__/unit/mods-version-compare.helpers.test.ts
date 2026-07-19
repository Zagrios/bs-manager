import { getCompareModsMaps, getModComparisonState, ModCompareType, ModComparisonState } from "shared/helpers/mods-version-compare.helpers";
import { BbmCategories, BbmFullMod, BbmModVersion, BbmPlatform, BbmStatus, BbmUserAPIResponse } from "shared/models/mods/mod.interface";

const author: BbmUserAPIResponse = {
    id: 1,
    username: "tester",
    githubId: "tester",
    sponsorUrl: "",
    displayName: "Tester",
    bio: "",
};

function createInstalledVersion(id: number, modId: number, dllPath?: string, modVersion = "1.0.0"): BbmModVersion {
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

function createComparableMod(version: string): ModCompareType {
    return { id: 1, name: "Test mod", version };
}

describe("mods version compare helpers", () => {
    test("builds installed mods map from installed modId only", () => {
        const availableMods = [
            createFullMod(1, "Installed mod"),
            createFullMod(2, "Available only"),
        ];
        const installedMods = [createInstalledVersion(101, 1, undefined, "1.2.3")];

        const { availableModsMap, installedModsMap } = getCompareModsMaps(availableMods, installedMods);

        expect(availableModsMap.get(BbmCategories.Core).map(mod => mod.id)).toEqual([1, 2]);
        expect(installedModsMap.get(BbmCategories.Core)).toEqual([
            { id: 1, name: "Installed mod", version: "1.2.3" },
        ]);
    });

    test("preserves installed-only mods missing from the available list", () => {
        const { availableModsMap, installedModsMap } = getCompareModsMaps([], [
            createInstalledVersion(201, 999, "Plugins/LocalOnly.dll", "2.0.0"),
        ]);

        const expectedInstalledOnlyMod = { id: 999, name: "LocalOnly", version: "2.0.0" };
        expect(availableModsMap.get(BbmCategories.Other)).toEqual([expectedInstalledOnlyMod]);
        expect(installedModsMap.get(BbmCategories.Other)).toEqual([expectedInstalledOnlyMod]);
    });

    test.each([
        [createComparableMod("1.0.0"), true, ModComparisonState.Reference],
        [createComparableMod("1.0.0"), false, ModComparisonState.Equal],
        [createComparableMod("2.0.0"), false, ModComparisonState.Higher],
        [createComparableMod("0.9.0"), false, ModComparisonState.Lower],
        [null, false, ModComparisonState.Missing],
    ])("classifies a compared mod against the primary version", (comparedMod, isReference, expectedState) => {
        expect(getModComparisonState(createComparableMod("1.0.0"), comparedMod, isReference)).toBe(expectedState);
    });

    test("classifies a mod missing from the primary version as newly added", () => {
        expect(getModComparisonState(null, createComparableMod("1.0.0"))).toBe(ModComparisonState.Added);
    });
});
