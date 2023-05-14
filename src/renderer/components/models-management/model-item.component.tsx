import equal from "fast-deep-equal";
import { memo, useState } from "react";
import { MSModel, MSModelType } from "shared/models/models/model-saber.model";
import { BsmImage } from "../shared/bsm-image.component";
import { motion } from "framer-motion";
import { GlowEffect } from "../shared/glow-effect.component";
import { MODELS_TYPE_MS_PAGE_ROOT, MODEL_SABER_URL } from "shared/models/models/constants";
import { BsmLink } from "../shared/bsm-link.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import Tippy from "@tippyjs/react";
import { followCursor } from "tippy.js"
import defaultImage from '../../../../assets/images/default-version-img.jpg'
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { BsmIconType } from "../svgs/bsm-icon.component";
import { Observable, of } from "rxjs";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BsmButton } from "../shared/bsm-button.component";

type Props = {
    selected?: boolean,
    hash: string,
    id: number,
    isDownloading?: Observable<boolean>
    onDelete?: () => void,
    onDownload?: () => void,
    onCancelDownload?: () => void
} & Partial<MSModel> & Partial<BsmLocalModel> & Omit<React.ComponentProps<"li">, "id">

export const ModelItem = memo((props: Props) => {

    const color = useThemeColor("first-color");
    const [hovered, setHovered] = useState(false);
    const [idContentCopied, setIdContentCopied] = useState<string>(null);
    const isDownloading = useObservable(props.isDownloading ?? of(false), false);

    const modelPageUrl = (() => {
        if(!props.id){ return null; }
        const url = new URL(MODELS_TYPE_MS_PAGE_ROOT[props.type], MODEL_SABER_URL);
        url.searchParams.set("id", props.id.toString());
        return url.toString();
    })();

    const authorPageUrl = (() => {
        if(!props.discordid){ return null; }
        const url = new URL("Profile", MODEL_SABER_URL);
        url.searchParams.set("user", props.discord.toString());
        return url.toString();
    })();

    const actionButtons = (): {text: string, icon: BsmIconType, action: () => void}[] => {
        const buttons: {text: string, icon: BsmIconType, action: () => void}[]  = [];
        
        if(props.onDownload){
            buttons.push({ text: "Download", icon: "download", action: props.onDownload }); // TODO TRANSLATE
        }

        if(props.onDelete){
            buttons.push({ text: "Delete", icon: "trash", action: props.onDelete }); // TODO TRANSLATE
        }

        if(props.onCancelDownload){
            buttons.push({ text: "Cancel download", icon: "cross", action: props.onCancelDownload }); // TODO TRANSLATE
        }

        return buttons;
    }

    const copyContent = (value: string, id?: string) => {
        navigator.clipboard.writeText(value);
        setIdContentCopied(() => id);
        setTimeout(() => {
            setIdContentCopied(() => null);
        }, 700);
    }

    return (
        // TODO TRANSLATE ALL TEXT
        <motion.li className={`relative flex-grow min-w-[13rem] h-52 cursor-pointer ${props.className ?? ""}`} onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)} onClick={props.onClick}>
            <GlowEffect visible={props.selected || hovered}/>
            <div>
                {!isDownloading ? (
                    <div>
                        {actionButtons().map((button, index) => (
                            <Tippy key={index} placement="top" content={button.text} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                                <BsmButton className="absolute top-0 right-0 w-6 h-6 p-1 bg-main-color-3 bg-opacity-60 backdrop-blur-md rounded-md text-white" onClick={e => {e.stopPropagation(); e.preventDefault(); button.action();}}/>
                            </Tippy>
                        ))}
                    </div>
                ) : (
                    <div>
                        
                    </div>
                )}
            </div>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg overflow-hidden blur-none">
                <BsmImage className={`absolute top-0 left-0 w-full h-full object-cover ${props.type === MSModelType.Avatar ? "object-top" : ""}`} image={props.thumbnail} placeholder={defaultImage} loading="lazy"/>
                <motion.div className="absolute cursor-default top-[80%] left-0 w-full h-full p-2 flex flex-col gap-1.5 bg-main-color-3 bg-opacity-60 backdrop-blur-md transition-all hover:top-0" onClick={e =>{e.stopPropagation(); e.preventDefault()}}>
                    <BsmLink className={`block w-fit max-w-full overflow-hidden font-bold whitespace-nowrap text-ellipsis ${props.id ? "cursor-pointer hover:underline" : ""}`} href={modelPageUrl}>{props.name}</BsmLink>
                    <BsmLink className={`block w-fit max-w-full overflow-hidden whitespace-nowrap text-ellipsis brightness-200 ${authorPageUrl ? "cursor-pointer hover:underline" : ""}`} style={{color}} href={authorPageUrl}>{props.author ?? ''}</BsmLink>
                    <ul className="flex flex-row flex-wrap gap-1">
                        {props.tags?.map(tag => (
                            <li key={tag} className="inline-block mr-1 text-xs bg-white text-black px-1 rounded-full p-0.5">{tag}</li>
                        ))}
                    </ul>
                    <Tippy placement="top" content={idContentCopied === "hash" ? "Copied!" : "Copy hash"} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                        <span className="mt-0.5 cursor-copy block w-full max-w-fit overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 uppercase text-xs" onClick={() => copyContent(`${props.hash}`, 'hash')}>{props.hash}</span>
                    </Tippy>
                        <div className="flex gap-1">
                            {props.id && (
                                <Tippy placement="top" content={idContentCopied === "id" ? "Copied!" : "Copy id"} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                                    <span className="cursor-copy w-fit shrink-0 max-w-full overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 uppercase text-xs" onClick={() => copyContent(`${props.id}`, 'id')}>{props.id}</span>
                                </Tippy>
                            )}
                            {props.path && (
                                <Tippy placement="top" content={idContentCopied === "path" ? "Copied!" : "Copy path"} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                                    <span className="cursor-copy w-fit max-w-full overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 text-xs" onClick={() => copyContent(`${props.path}`, 'path')}>{props.path}</span>
                                </Tippy>
                            )}
                        </div>
                </motion.div>
            </div>
        </motion.li>
    )
}, equal);
