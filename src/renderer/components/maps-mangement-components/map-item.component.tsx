import { BsmImage } from "../shared/bsm-image.component";
import { BsvMapCharacteristic, BsvMapDifficultyType } from "shared/models/maps/beat-saver.model"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsmLink } from "../shared/bsm-link.component";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { BsmButton } from "../shared/bsm-button.component";
import { motion } from "framer-motion";

export type MapItemProps = {
    hash: string,
    title: string,
    autor: string,
    songAutor: string,
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

export function MapItem({hash, title, autor, songAutor, coverUrl, songUrl, autorLink, mapId, diffs, qualified, ranked, onDelete, onDownload}: MapItemProps) {

    const color = useThemeColor("first-color");

    const zipUrl = `https://r2cdn.beatsaver.com/${hash}.zip`;
    const previewUrl = `https://skystudioapps.com/bs-viewer/?url=${zipUrl}`;
    const mapUrl = mapId ? `https://beatsaver.com/maps/${mapId}` : null;


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
            <li key={`${charac}-${diff}`} className="h-5 flex justify-center items-center gap-1 rounded-full px-2 active:brightness-75" style={{backgroundColor: colorPill}}>
                <BsmIcon className="h-4 w-4" icon="bsMapDifficulty"/>
                <span className="text-xs mb-[1.5px]">{diff === "ExpertPlus" ? "Expert+" : diff}</span>
            </li>
        )
    }

    const scrollDiffs = (e: React.MouseEvent<HTMLOListElement, MouseEvent>) => {
        
        const el = e.currentTarget;
        const rect = e.currentTarget.getBoundingClientRect();

        console.log(el.scrollHeight - (el.scrollWidth - el.clientWidth))

        let yProgress = (((e.clientX - rect.left) - ((el.clientWidth / el.scrollWidth) * 100)) / (rect.width));

        yProgress = yProgress < 0 ? 0 : yProgress > 1 ? 1 : yProgress; 

        e.currentTarget.scrollTo({left: e.currentTarget.scrollWidth * yProgress})
    }

    const resetScrollDiffs = (e: React.MouseEvent<HTMLOListElement, MouseEvent>) => {
        e.currentTarget.scrollTo({left: 0, behavior: "smooth"});
    }

    return (
        <li className="relative pl-[90px] rounded-md flex flex-row justify-end h-[100px] min-w-[400px] shrink overflow-hidden grow basis-0 text-white group">
            <div className="absolute top-0 left-0 h-full w-[100px]">
                <BsmImage image={coverUrl}/>
                <span className="absolute block w-full h-full bg-transparent top-0 left-0"></span>
            </div>
            <div className="h-full w-full z-[1] relative rounded-md overflow-hidden">
                <BsmImage className="absolute w-full h-full object-cover" image={coverUrl}/>
                <div className="absolute py-1 pl-2 pr-7 top-0 left-0 w-full h-full bg-gray-600 bg-opacity-80 flex flex-col group-hover:bg-main-color-2 group-hover:bg-opacity-80">
                    <h1 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full leading-5 tracking-wide">{title}</h1>
                    <h2 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-sm mb-1">par {songAutor}</h2>
                    <h3 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-[13px]">mappée par <BsmLink href={autorLink} className="brightness-150 saturate-50 hover:underline" style={{color}}>{autor}</BsmLink></h3>
                </div> 
            </div>
            <div className="absolute bg-main-color-3 top-0 right-0 h-full w-2 group-hover:w-7 transition-all z-10">
                sp
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
