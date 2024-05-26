import { AnimatePresence, motion } from "framer-motion";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import BeatConflict from "../../../../../../../assets/images/apngs/beat-conflict.png";
import { Observable } from "rxjs";
import { useObservable } from "renderer/hooks/use-observable.hook";

type Props = {
    isPlaylistInQueue$: Observable<boolean>;
    isPlaylistDownloading$: Observable<boolean>;
    isMissingMaps$: Observable<boolean>;
    installPlaylist: () => void;
}

export function PlaylistHeaderState({isPlaylistInQueue$, isPlaylistDownloading$, isMissingMaps$, installPlaylist}: Props) {

    const isPlaylistInQueue = useObservable(() => isPlaylistInQueue$, false);
    const isPlaylistDownloading = useObservable(() => isPlaylistDownloading$, false);
    const isMissingMaps = useObservable(() => isMissingMaps$, false);

    console.log(isPlaylistInQueue, isPlaylistDownloading, isMissingMaps);

    const renderHeaderContent = () => {

        if(isPlaylistDownloading) {
            return (
                <>
                    <BsmImage image={BeatConflict} className="size-24"/>
                    <div className="text-white font-bold w-fit space-y-1.5 flex flex-col justify-center items-center">
                        <p>La playlist est en cours de téléchargement</p>
                    </div>
                </>
            )
        }

        if(isPlaylistInQueue) {
            return (
                <>
                    <BsmImage image={BeatConflict} className="size-24"/>
                    <div className="text-white font-bold w-fit space-y-1.5 flex flex-col justify-center items-center">
                        <p>La Playlist est en attente de téléchargment</p>
                    </div>
                </>
            )
        }

        return  (
            <>
                <BsmImage image={BeatConflict} className="size-24"/>
                <div className="text-white font-bold w-fit space-y-1.5 flex flex-col justify-center items-center">
                    <p>Certaines maps de cette playlist sont manquantes</p>
                    <BsmButton withBar={false} onClick={installPlaylist} className="rounded-md h-8 flex items-center justify-center px-4" typeColor="primary" text="Télécharger.les.maps.manquantes"/>
                </div>
            </>
        );
    }

    return (
        <AnimatePresence>
            {(isPlaylistInQueue || isPlaylistDownloading || isMissingMaps) && <motion.div
                initial={{ height: 0 }}
                animate={{ height: "7rem" }}
                exit={{ height: 0 }}
                transition={{delay: .25, duration: .25}}
                className="shrink-0 w-full text-center overflow-hidden flex justify-center items-center"
            >
                <div className="size-[calc(100%-1rem)] bg-main-color-2 rounded-md translate-y-1.5 flex flex-row justify-center items-center gap-3">
                    {renderHeaderContent()}
                </div>
            </motion.div>}
        </AnimatePresence>
    )
}
