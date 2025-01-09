import { Comparison } from "../comparator.type";
import { Sorter } from "../sorter.model";
import { BsmLocalMap } from "./bsm-local-map.interface";

const sortName = (map1: BsmLocalMap, map2: BsmLocalMap) => map1.mapInfo.songName.localeCompare(map2.mapInfo.songName);

export const mapSorter = new Sorter<BsmLocalMap>({
    comparators: {
        name: sortName,
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
    },
    tiebreak: sortName,
    defaultKey: "name"
});

