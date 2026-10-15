import { BbmCategories, BbmFullMod, BbmModVersion, BbmStatus } from "shared/models/mods/mod.interface";
import { safeLt } from "./semver.helpers";

export type ModsState = Readonly<{
    mods: BbmFullMod[];
    installed: BbmFullMod[];
}>;

export type InstallPlanOptions = Readonly<{
    reinstall?: boolean;
}>;

// To save memory when caching
export interface ModCompareType {
    id: number;
    name: string;
    version: string;
}

export enum ModComparisonState {
    Reference = "reference",
    Added = "added",
    Equal = "equal",
    Higher = "higher",
    Lower = "lower",
    Missing = "missing",
}

export type ModCompareMaps = Readonly<{
    availableModsMap: Map<BbmCategories, ModCompareType[]>;
    installedModsMap: Map<BbmCategories, ModCompareType[]>;
}>;

export const EMPTY_MODS_STATE: ModsState = { mods: [], installed: [] };

function fullModFromInstalledVersion(availableMods: BbmFullMod[], installedMod: BbmModVersion): BbmFullMod {
    const availableMod = availableMods.find(mod => mod.mod.id === installedMod.modId);
    if (availableMod) {
        return { ...availableMod, version: installedMod };
    }

    // Mod is installed but not in the available (verified) list.
    // Construct a minimal BbmMod so it still appears in the UI.
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

export function getModsState(availableMods: BbmFullMod[], installedMods: BbmModVersion[]): ModsState {
    const available = availableMods ?? [];
    const installed = (installedMods ?? []).map(installedMod => fullModFromInstalledVersion(available, installedMod));
    const availableModIds = new Set(available.map(mod => mod.mod.id));

    return {
        mods: [...available, ...installed.filter(mod => !availableModIds.has(mod.mod.id))],
        installed,
    };
}

export function isModOutdated(installedVersion: string | undefined, availableVersion: string): boolean {
    return !!installedVersion && safeLt(installedVersion, availableVersion);
}

function findInstalled(state: ModsState, mod: BbmFullMod): BbmFullMod | undefined {
    return state.installed.find(installedMod => installedMod.mod.id === mod.mod.id);
}

export function getOutdatedMods(state: ModsState): BbmFullMod[] {
    return state.mods.filter(mod => isModOutdated(findInstalled(state, mod)?.version.modVersion, mod.version.modVersion));
}

export function getDefaultSelectedMods(state: ModsState): BbmFullMod[] {
    const nothingInstalled = !state.installed.length;
    return state.mods.filter(mod => (
        mod.mod.category === BbmCategories.Core
        || (nothingInstalled && mod.mod.category === BbmCategories.Essential)
        || !!findInstalled(state, mod)
    ));
}

export function getDependencyClosure(mods: BbmFullMod[], candidates: BbmFullMod[]): BbmFullMod[] {
    const dependencies: BbmFullMod[] = [];
    const visitedIds = new Set<number>();
    const idsToProcess = mods.flatMap(mod => mod.version.dependencies ?? []);

    while (idsToProcess.length) {
        const id = idsToProcess.shift();
        if (visitedIds.has(id)) {
            continue;
        }
        visitedIds.add(id);

        const dependency = candidates.find(mod => mod.version.id === id);
        if (dependency) {
            dependencies.push(dependency);
            idsToProcess.push(...(dependency.version.dependencies ?? []));
        }
    }

    return dependencies;
}

export function getModsToInstall(state: ModsState, selected: BbmFullMod[], { reinstall = false }: InstallPlanOptions = {}): BbmFullMod[] {
    const toInstall = new Map<number, BbmFullMod>();

    for (const mod of [...selected, ...getDependencyClosure(selected, state.mods)]) {
        if (toInstall.has(mod.mod.id)) {
            continue;
        }
        const installedMod = findInstalled(state, mod);
        if (reinstall || !installedMod || isModOutdated(installedMod.version.modVersion, mod.version.modVersion)) {
            toInstall.set(mod.mod.id, mod);
        }
    }

    return Array.from(toInstall.values());
}

export const simplifyFullMod = (mod: BbmFullMod): ModCompareType => ({
    id: mod.mod.id,
    name: mod.mod.name,
    version: mod.version.modVersion,
});

export function getModComparisonState(
    referenceMod: ModCompareType | null,
    comparedMod: ModCompareType | null,
    isReference = false
): ModComparisonState {
    if (!comparedMod) {
        return ModComparisonState.Missing;
    }
    if (isReference) {
        return ModComparisonState.Reference;
    }
    if (!referenceMod) {
        return ModComparisonState.Added;
    }
    if (referenceMod.version === comparedMod.version) {
        return ModComparisonState.Equal;
    }

    return isModOutdated(referenceMod.version, comparedMod.version)
        ? ModComparisonState.Higher
        : ModComparisonState.Lower;
}

function toCompareModsMap(mods: BbmFullMod[]): Map<BbmCategories, ModCompareType[]> {
    const map = new Map<BbmCategories, ModCompareType[]>();
    mods.forEach(mod => map.set(mod.mod.category, [...(map.get(mod.mod.category) ?? []), simplifyFullMod(mod)]));
    return map;
}

export function getCompareModsMaps(availableMods: BbmFullMod[], installedMods: BbmModVersion[] = []): ModCompareMaps {
    const { mods, installed } = getModsState(availableMods, installedMods);
    return {
        availableModsMap: toCompareModsMap(mods),
        installedModsMap: toCompareModsMap(installed),
    };
}
