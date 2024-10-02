import { Comparator } from "shared/models/generics.type";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";


export class MapsSorterService {
    private static instance: MapsSorterService;

    public static getInstance() {
        if (!MapsSorterService.instance) {
            MapsSorterService.instance = new MapsSorterService();
        }
        return MapsSorterService.instance;
    }

    private readonly comparators: {
        [key: string]: Comparator<BsmLocalMap>;
    } = {
        name: (map1, map2) =>
            map1.rawInfo._songName.localeCompare(map2.rawInfo._songName),
        "song-author": (map1, map2) =>
            map1.rawInfo._songAuthorName.localeCompare(map2.rawInfo._songAuthorName),
        "map-author": (map1, map2) =>
            map1.rawInfo._levelAuthorName.localeCompare(map2.rawInfo._levelAuthorName),
        bpm: (map1, map2) =>
            map1.rawInfo._beatsPerMinute - map2.rawInfo._beatsPerMinute,
        duration: (map1, map2) => {
            if (!map1.songDetails) {
                return map2.songDetails ? -1 : 0;
            }

            return !map2.songDetails ? -1
                : map1.songDetails.duration - map2.songDetails.duration;
        },
        likes: (map1, map2) => {
            if (!map1.songDetails) {
                return map2.songDetails ? -1 : 0;
            }

            return !map2.songDetails ? -1
                : map1.songDetails.upVotes - map2.songDetails.upVotes;
        },
        "date-uploaded": (map1, map2) => {
            if (!map1.songDetails) {
                return map2.songDetails ? -1 : 0;
            }

            return !map2.songDetails ? -1
                : map1.songDetails.uploadedAt - map2.songDetails.uploadedAt;
        }
    };

    public getComparatorKeys(): string[] {
        return Object.keys(this.comparators);
    }

    public getDefaultComparator(): Comparator<BsmLocalMap> {
        return this.comparators.name;
    }

    public getComparator(key: string): Comparator<BsmLocalMap> {
        const comparator = this.comparators[key];
        return comparator || this.comparators.name;
    }

}
