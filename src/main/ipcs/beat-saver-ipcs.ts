import { BeatSaverService } from "../services/thrid-party/beat-saver/beat-saver.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("bsv-search-map", (args, reply) => {
    const bsvService = BeatSaverService.getInstance();
    reply(from(bsvService.searchMaps(args)));
});

ipc.on("bsv-get-map-details-from-hashs", (args, reply) => {
    const bsvService = BeatSaverService.getInstance();
    reply(from(bsvService.getMapDetailsFromHashs(args)));
});

ipc.on("bsv-get-map-details-by-id", (args, reply) => {
    const bsvService = BeatSaverService.getInstance();
    reply(from(bsvService.getMapDetailsById(args)));
});

ipc.on("bsv-search-playlist", (args, reply) => {
    const bsvService = BeatSaverService.getInstance();
    reply(from(bsvService.searchPlaylists(args)));
});

ipc.on("bsv-get-playlist-details-by-id", (args, reply) => {
    const bsvService = BeatSaverService.getInstance();
    reply(from(bsvService.getPlaylistDetailsById(args.id, args.page)));
});
