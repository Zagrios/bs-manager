import { BbmCategories, BbmFullMod, BbmModVersion, BbmStatus } from "shared/models/mods/mod.interface";

// To save memory when caching
export interface ModCompareType {
    id: number;
    name: string;
    version: string;
}

export type ModCompareMaps = Readonly<{
    availableModsMap: Map<BbmCategories, ModCompareType[]>;
    installedModsMap: Map<BbmCategories, ModCompareType[]>;
}>;

export const simplifyFullMod = (mod: BbmFullMod): ModCompareType => ({
    id: mod.mod.id,
    name: mod.mod.name,
    version: mod.version.modVersion,
});

function addModToMap(map: Map<BbmCategories, ModCompareType[]>, fullMod: BbmFullMod): void {
    map.set(fullMod.mod.category, [
        ...(map.get(fullMod.mod.category) ?? []),
        simplifyFullMod(fullMod),
    ]);
}

function fullModFromInstalledVersion(availableMods: BbmFullMod[], installedMod: BbmModVersion): BbmFullMod {
    const availableMod = availableMods.find(mod => mod.mod.id === installedMod.modId);
    if (availableMod) {
        return { ...availableMod, version: installedMod };
    }

    // Mod is installed but not in the available (verified) list.
    // Construct a minimal BbmMod so it still appears in the comparison UI.
    const dllHash = installedMod.contentHashes?.find(hash => hash.path.endsWith(".dll"));
    const name = dllHash
        ? dllHash.path.replace(/^.*[\\/]/, "").replace(/\.dll$/, "")
        : `Unknown mod (${installedMod.modId})`;

    return {
        mod: {
            id: installedMod.modId,
            name,
            summary: "",
            description: "",
            gameName: "BeatSaber",
            category: BbmCategories.Other,
            authors: installedMod.author ? [installedMod.author] : [],
            status: installedMod.status ?? BbmStatus.Unverified,
            iconFileName: "",
            gitUrl: "",
            lastApprovedById: installedMod.lastApprovedById ?? null,
            lastUpdatedById: installedMod.lastUpdatedById ?? null,
            createdAt: installedMod.createdAt ?? new Date(),
            updatedAt: installedMod.updatedAt ?? new Date(),
        },
        version: installedMod,
    };
}

export function getCompareModsMaps(availableMods: BbmFullMod[], installedMods: BbmModVersion[] = []): ModCompareMaps {
    const installedFullMods = installedMods.map(installedMod => fullModFromInstalledVersion(availableMods, installedMod));
    const availableModIds = new Set(availableMods.map(mod => mod.mod.id));
    const availableAndInstalledOnlyMods = [
        ...availableMods,
        ...installedFullMods.filter(mod => !availableModIds.has(mod.mod.id)),
    ];

    const availableModsMap = new Map<BbmCategories, ModCompareType[]>();
    availableAndInstalledOnlyMods.forEach(mod => addModToMap(availableModsMap, mod));

    const installedModsMap = new Map<BbmCategories, ModCompareType[]>();
    installedFullMods.forEach(mod => addModToMap(installedModsMap, mod));

    return { availableModsMap, installedModsMap };
}
