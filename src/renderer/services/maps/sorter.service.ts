import { Comparator, Comparison } from "shared/models/comparator.type";
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
        name: (map1, map2) => map1.mapInfo.songName.localeCompare(map2.mapInfo.songName),
        "song-author": (map1, map2) => map1.mapInfo.songAuthorName.localeCompare(map2.mapInfo.songAuthorName),
        "map-author": (map1, map2) => {
            // Compare the number of mappers, else compare the first mapper
            const difference = map1.mapInfo.levelMappers.length - map2.mapInfo.levelMappers.length;
            return difference || map1.mapInfo.levelMappers[0].localeCompare(map2.mapInfo.levelMappers[0]);
        },
        bpm: (map1, map2) => map1.mapInfo.beatsPerMinute - map2.mapInfo.beatsPerMinute,
        duration: (map1, map2) => {
            if (!map1.songDetails) {
                return map2.songDetails ? Comparison.LESSER : Comparison.EQUAL;
            }

            return !map2.songDetails ? Comparison.GREATER : map1.songDetails.duration - map2.songDetails.duration;
        },
        likes: (map1, map2) => {
            if (!map1.songDetails) {
                return map2.songDetails ? Comparison.LESSER : Comparison.EQUAL;
            }

            return !map2.songDetails ? Comparison.GREATER : map1.songDetails.upVotes - map2.songDetails.upVotes;
        },
        "date-uploaded": (map1, map2) => {
            if (!map1.songDetails) {
                return map2.songDetails ? Comparison.LESSER : Comparison.EQUAL;
            }

            return !map2.songDetails ? Comparison.GREATER : map1.songDetails.uploadedAt - map2.songDetails.uploadedAt;
        },
    };

    private addTiebreak(comparator: Comparator<BsmLocalMap>): Comparator<BsmLocalMap> {
        return (map1, map2) => comparator(map1, map2) || this.getDefaultComparator()(map1, map2);
    }

    public getComparatorKeys(): string[] {
        return Object.keys(this.comparators);
    }

    public getDefaultComparatorKey(): string {
        return "name";
    }

    public getDefaultComparator(): Comparator<BsmLocalMap> {
        return this.comparators.name;
    }

    public getComparator(key: string): Comparator<BsmLocalMap> {
        const comparator = this.comparators[key];
        return comparator ? this.addTiebreak(comparator) : this.getDefaultComparator();
    }
}
