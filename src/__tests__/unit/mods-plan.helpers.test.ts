import {
    getCompareModsMaps,
    getDefaultSelectedMods,
    getDependencyClosure,
    getModComparisonState,
    getModsState,
    getModsToInstall,
    getOutdatedMods,
    isModOutdated,
    ModCompareType,
    ModComparisonState,
} from "shared/helpers/mods-plan.helpers";
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

function createFullMod(id: number, name: string, category = BbmCategories.Core, versionId = id, modVersion = "1.0.0", dependencies: number[] = []): BbmFullMod {
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
        version: { ...createInstalledVersion(versionId, id, undefined, modVersion), dependencies },
    };
}

function ids(mods: BbmFullMod[]): number[] {
    return mods.map(mod => mod.mod.id);
}

function createComparableMod(version: string): ModCompareType {
    return { id: 1, name: "Test mod", version };
}

describe("mods plan helpers", () => {
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

    describe("mods state", () => {
        test("merges installed-only mods after the available ones", () => {
            const state = getModsState(
                [createFullMod(1, "Available")],
                [createInstalledVersion(101, 1), createInstalledVersion(201, 999, "Plugins/LocalOnly.dll")]
            );

            expect(ids(state.mods)).toEqual([1, 999]);
            expect(ids(state.installed)).toEqual([1, 999]);
            expect(state.mods[1].mod).toMatchObject({ name: "LocalOnly", category: BbmCategories.Other });
        });

        test("keeps the available mod infos with the installed version", () => {
            const available = createFullMod(1, "Available", BbmCategories.Library, 10, "2.0.0");
            const { installed } = getModsState([available], [createInstalledVersion(101, 1, undefined, "1.0.0")]);

            expect(installed[0].mod).toBe(available.mod);
            expect(installed[0].version.id).toBe(101);
        });

        test("preserves approval infos of installed-only mods", () => {
            const installedVersion = { ...createInstalledVersion(201, 999), lastApprovedById: 7, lastUpdatedById: 8 };
            const { installed } = getModsState([], [installedVersion]);

            expect(installed[0].mod.lastApprovedById).toBe(7);
            expect(installed[0].mod.lastUpdatedById).toBe(8);
            expect(installed[0].mod.name).toBe("Unknown mod (999)");
        });

        test("tolerates missing lists", () => {
            expect(getModsState(null, undefined)).toEqual({ mods: [], installed: [] });
        });
    });

    describe("outdated", () => {
        test.each([
            [undefined, "1.0.0", false],
            ["1.0.0", "1.0.0", false],
            ["1.0.0", "1.1.0", true],
            ["2.0.0", "1.1.0", false],
            ["not-a-version", "1.1.0", false],
        ])("installed %s against available %s is outdated: %s", (installed, available, expected) => {
            expect(isModOutdated(installed, available)).toBe(expected);
        });

        test("lists available mods with an older version installed", () => {
            const state = getModsState(
                [createFullMod(1, "Outdated", BbmCategories.Core, 1, "1.1.0"), createFullMod(2, "Up to date"), createFullMod(3, "Not installed", BbmCategories.Core, 3, "9.0.0")],
                [createInstalledVersion(101, 1, undefined, "1.0.0"), createInstalledVersion(102, 2), createInstalledVersion(201, 999, "Plugins/LocalOnly.dll")]
            );

            const outdated = getOutdatedMods(state);

            expect(ids(outdated)).toEqual([1]);
            expect(outdated[0].version.modVersion).toBe("1.1.0");
        });
    });

    describe("default selection", () => {
        const available = [
            createFullMod(1, "Core", BbmCategories.Core),
            createFullMod(2, "Essential", BbmCategories.Essential),
            createFullMod(3, "Gameplay", BbmCategories.Gameplay),
        ];

        test("selects core and essential mods when nothing is installed", () => {
            expect(ids(getDefaultSelectedMods(getModsState(available, [])))).toEqual([1, 2]);
        });

        test("selects core and installed mods otherwise", () => {
            const state = getModsState(available, [createInstalledVersion(103, 3), createInstalledVersion(201, 999, "Plugins/LocalOnly.dll")]);
            expect(ids(getDefaultSelectedMods(state))).toEqual([1, 3, 999]);
        });
    });

    describe("dependency closure", () => {
        test("collects transitive dependencies by version id", () => {
            const a = createFullMod(1, "A", BbmCategories.Gameplay, 10, "1.0.0", [20]);
            const b = createFullMod(2, "B", BbmCategories.Library, 20, "1.0.0", [30]);
            const c = createFullMod(3, "C", BbmCategories.Library, 30, "1.0.0", [40]);
            const d = createFullMod(4, "D", BbmCategories.Library, 40);
            const unrelated = createFullMod(5, "E", BbmCategories.Library, 50);

            expect(ids(getDependencyClosure([a], [a, b, c, d, unrelated]))).toEqual([2, 3, 4]);
        });

        test("terminates on dependency cycles and ignores unknown ids", () => {
            const a = createFullMod(1, "A", BbmCategories.Library, 10, "1.0.0", [20, 404]);
            const b = createFullMod(2, "B", BbmCategories.Library, 20, "1.0.0", [10]);

            expect(ids(getDependencyClosure([a], [a, b]))).toEqual([2, 1]);
        });
    });

    describe("install plan", () => {
        const lib = createFullMod(2, "Lib", BbmCategories.Library, 20, "1.1.0");
        const upToDate = createFullMod(3, "Up to date", BbmCategories.Gameplay, 30, "1.0.0");
        const mod = createFullMod(1, "Mod", BbmCategories.Gameplay, 10, "1.0.0", [20]);
        const state = getModsState(
            [mod, lib, upToDate],
            [createInstalledVersion(102, 2, undefined, "1.0.0"), createInstalledVersion(103, 3), createInstalledVersion(201, 999, "Plugins/LocalOnly.dll")]
        );
        const installedOnly = state.mods.find(m => m.mod.id === 999);

        test("installs missing and outdated mods with their dependencies", () => {
            expect(ids(getModsToInstall(state, [mod, upToDate, installedOnly]))).toEqual([1, 2]);
        });

        test("reinstalls every selected mod and dependency once", () => {
            expect(ids(getModsToInstall(state, [mod, lib, upToDate, installedOnly], { reinstall: true }))).toEqual([1, 2, 3, 999]);
        });

        test("installs nothing when everything is up to date", () => {
            expect(getModsToInstall(state, [upToDate])).toEqual([]);
        });
    });
});
