import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface"
import { BsmImage } from "../shared/bsm-image.component";
import { BsvMapCharacteristic, BsvMapDifficultyType } from "shared/models/maps/beat-saver.model"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { BsmLink } from "../shared/bsm-link.component";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { BsmButton } from "../shared/bsm-button.component";

export type MapItemProps = {
    hash: string,
    title: string,
    autor: string,
    coverUrl: string,
    songUrl: string,
    autorLink: string,
    mapId: string,
    diffs: Map<BsvMapCharacteristic, BsvMapDifficultyType[]>,
    qualified: boolean,
    ranked: boolean,
    bpm: number,
    duration: number,
    onDelete?: (hash: string) => void,
    onDownload?: (id: string) => void,
}

export function MapItem({hash, title, autor, coverUrl, songUrl, autorLink, mapId, diffs, qualified, ranked, onDelete, onDownload}: MapItemProps) {

    const color = useThemeColor("first-color");

    const zipUrl = `https://r2cdn.beatsaver.com/${hash}.zip`
    const previewUrl = `https://skystudioapps.com/bs-viewer/?url=${zipUrl}`

    console.log(diffs)

    const renderAutor = () => {
        if(!autor){ null; }
        if(autorLink){
            return <BsmLink className="text-sm mb-1" href={autorLink} style={{color}}>{autor}</BsmLink>
        }
        return <span className="text-sm mb-1 text-gray-500">{autor}</span>
    }

    const renderDiff = (charac: BsvMapCharacteristic, diff: BsvMapDifficultyType) => {

        const colorPill = diffColors[diff] ?? "";

        return (
            <li className="h-5 flex justify-center items-center gap-1 rounded-full px-2" style={{backgroundColor: colorPill}}>
                <BsmIcon className="h-4 w-4" icon="bsMapDifficulty"/>
                <span className="text-xs mb-[1.5px]">{diff === "ExpertPlus" ? "Expert+" : diff}</span>
            </li>
        )
    }

    return (
        <li className="bg-main-color-1 rounded-md flex flex-row h-[120px] min-w-[400px] shrink overflow-hidden grow text-white basis-0">
            <BsmImage className="" image={coverUrl}/>
            <div className="h-full flex flex-col grow px-3 min-w-0 shrink">
                <h1 className={`font-bold overflow-hidden text-ellipsis whitespace-nowrap ${mapId && "cursor-pointer hover:underline"}`} style={{textDecorationColor: color}}>{title}</h1>
                {renderAutor()}
                <ol className="flex pb-1 gap-2 scrollbar scrollbar-width-[4px] scrollbar-thumb-black scrollbar-track-transparent" style={{scrollbarGutter: "stable", }}>
                    {Array.from(diffs.entries()).map(([charac, diffs]) => diffs.map(diff => renderDiff(charac, diff)))}
                </ol> 
            </div>
            <div className="flex flex-col shrink-0 px-2 pt-1 gap-1">
                <BsmButton className="w-6 h-6 p-[2px] rounded-md !bg-inherit hover:backdrop-brightness-75" iconColor={color} icon="trash" title="allo" withBar={false}/>
                <BsmButton className="w-6 h-6 p-1 rounded-md !bg-inherit hover:backdrop-brightness-75" iconColor={color} icon="twitch" title="allo" withBar={false}/>
                <BsmButton className="w-6 h-6 pr-[2px] rounded-md !bg-inherit hover:backdrop-brightness-75" iconColor={color} icon="play" title="allo" withBar={false}/>
                <BsmLink href={previewUrl} internal>
                    <BsmButton className="w-6 h-6 px-[2px] rounded-md !bg-inherit hover:backdrop-brightness-75" iconColor={color} icon="eye" title="Preview" withBar={false}/>
                </BsmLink>
            </div>
        </li>
    )
}

const diffColors: Record<BsvMapDifficultyType, string> = {
    Easy: "#008055",
    Normal: "#1268a1",
    Hard: "#bd5500",
    Expert: "#b52a1c",
    ExpertPlus: "#7646af"
}
