import { BsmLocalMap } from "./maps/bsm-local-map.interface";

export interface LeaderboardColumn {
    header: string;
    key: keyof LeaderboardScore;
    headerAlignment?: "left" | "center" | "right";
    textAlignment?: "left" | "center" | "right";
    font?: "normal" | "mono";
    className?: string;
    default?: string;
    formatter?: (value: any) => string;
    condition?: (map: BsmLocalMap) => boolean;
}

export interface LeaderboardScore {
    id: string;
    rank: number;
    player: string;
    score: number;
    mods: string;
    accuracy: number; // ranging from 0.00 to 1.00
    pp: number;
}
