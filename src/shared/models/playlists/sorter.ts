import { Comparison } from "../comparator.type";
import { Sorter } from "../sorter.model";
import { LocalBPListsDetails } from "./local-playlist.models";

const sortTitle = (playlist1: LocalBPListsDetails, playlist2: LocalBPListsDetails) =>
    playlist1.playlistTitle.localeCompare(playlist2.playlistTitle);

export const playlistSorter = new Sorter({
    comparators: {
        title: sortTitle,
        author: (playlist1, playlist2) => playlist1.playlistAuthor.localeCompare(playlist2.playlistAuthor),
        "number-of-maps": (playlist1, playlist2) => playlist1.nbMaps - playlist2.nbMaps,
        duration: (playlist1, playlist2) => {
            if (!playlist1.duration) {
                return playlist2.duration ? Comparison.LESSER : Comparison.EQUAL;
            }

            return !playlist2.duration ? Comparison.GREATER : playlist1.duration - playlist2.duration;
        },
        "notes-per-second": (playlist1, playlist2) => {
            if (!playlist1.maxNps) {
                return playlist2.maxNps ? Comparison.LESSER : Comparison.EQUAL;
            }

            return !playlist2.maxNps ? Comparison.GREATER : playlist1.maxNps - playlist2.maxNps;
        },
    },
    tiebreak: sortTitle,
    defaultKey: "title",
});
