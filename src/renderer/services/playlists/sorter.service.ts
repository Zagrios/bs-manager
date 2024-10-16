import { Comparator, Comparison } from "shared/models/comparator.type";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";

export class PlaylistsSorterService {
    private static instance: PlaylistsSorterService;

    public static getInstance() {
        if (!PlaylistsSorterService.instance) {
            PlaylistsSorterService.instance = new PlaylistsSorterService();
        }
        return PlaylistsSorterService.instance;
    }

    private readonly comparators: {
        [key: string]: Comparator<LocalBPListsDetails>;
    } = {
        title: (playlist1, playlist2) => playlist1.playlistTitle.localeCompare(playlist2.playlistTitle),
        author: (playlist1, playlist2) => playlist1.playlistAuthor.localeCompare(playlist2.playlistAuthor),
        "number-of-maps": (playlist1, playlist2) => playlist1.nbMaps - playlist2.nbMaps,
        duration: (playlist1, playlist2) => {
            if (!playlist1.duration) {
                return playlist2.duration ? Comparison.LESSER : Comparison.EQUAL;
            }

            return !playlist2.duration ? Comparison.GREATER : playlist1.duration - playlist2.duration;
        },
        "min-notes-per-second": (playlist1, playlist2) => {
            if (!playlist1.minNps) {
                return playlist2.minNps ? Comparison.LESSER : Comparison.EQUAL;
            }

            return !playlist2.minNps ? Comparison.GREATER : playlist1.minNps - playlist2.minNps;
        },
        "max-notes-per-second": (playlist1, playlist2) => {
            if (!playlist1.maxNps) {
                return playlist2.maxNps ? Comparison.LESSER : Comparison.EQUAL;
            }

            return !playlist2.maxNps ? Comparison.GREATER : playlist1.maxNps - playlist2.maxNps;
        },
    };

    private addTiebreak(comparator: Comparator<LocalBPListsDetails>): Comparator<LocalBPListsDetails> {
        return (playlist1, playlist2) => comparator(playlist1, playlist2) || this.getDefaultComparator()(playlist1, playlist2);
    }

    public getComparatorKeys(): string[] {
        return Object.keys(this.comparators);
    }

    public getDefaultComparatorKey(): string {
        return "title";
    }

    public getDefaultComparator(): Comparator<LocalBPListsDetails> {
        return this.comparators.title;
    }

    public getComparator(key: string): Comparator<LocalBPListsDetails> {
        const comparator = this.comparators[key];
        return comparator ? this.addTiebreak(comparator) : this.getDefaultComparator();
    }
}
