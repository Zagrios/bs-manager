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
import { BsmButton } from "../shared/bsm-button.component";
import { BsmBasicSpinner } from "../shared/bsm-basic-spinner/bsm-basic-spinner.component";
import { isValidUrl } from "shared/helpers/url.helpers";

type Props<T> = {
    selected?: boolean,
    hash: string,
    id?: number,
    isDownloading?: boolean,
    callbackValue?: T
    onDelete?: (value: T) => void,
    onDownload?: (value: T) => void,
    onCancelDownload?: (value: T) => void
} & Partial<MSModel> & Partial<BsmLocalModel> & Omit<React.ComponentProps<"li">, "id">

function modelItem<T = unknown>(props: Props<T>) {

    const color = useThemeColor("first-color");
    const [hovered, setHovered] = useState(false);
    const [idContentCopied, setIdContentCopied] = useState<string>(null);

    const modelPageUrl = (() => {
        if(!props.id){ return null; }
        const url = new URL(MODELS_TYPE_MS_PAGE_ROOT[props.type], MODEL_SABER_URL);
        url.searchParams.set("id", props.id.toString());
        return url.toString();
    })();

    const authorPageUrl = (() => {
        if(!props.discord){ return null; }
        const url = new URL("Profile", MODEL_SABER_URL);
        url.searchParams.set("user", props.discord.toString());
        return url.toString();
    })();

    const thumbnailUrl = (() => {
        if(!props.thumbnail){ return null; }
        if(isValidUrl(props.thumbnail)){ return props.thumbnail; }
        const [file, ext] = props.thumbnail.split(".");
        return props.download.split("/").slice(0, -1).join("/") + `/${file}.${ext.toLowerCase()}`;
    })();

    const modelTags = (() => {
        if(!props.tags){ return null; }
        return [...new Set(props.tags)];
    })();

    console.log(thumbnailUrl, "la");

    const actionButtons = (): {text: string, icon: BsmIconType, action: () => void}[] => {
        const buttons: {text: string, icon: BsmIconType, action: () => void}[]  = [];
        
        if(props.onDownload){
            buttons.push({ text: "Download", icon: "download", action: () => props.onDownload(props.callbackValue) }); // TODO TRANSLATE
        }

        if(props.onDelete){
            buttons.push({ text: "Delete", icon: "trash", action: () => props.onDelete(props.callbackValue) }); // TODO TRANSLATE
        }

        if(props.onCancelDownload){
            buttons.push({ text: "Cancel download", icon: "cross", action: () => props.onCancelDownload(props.callbackValue) }); // TODO TRANSLATE
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
        <motion.li className={`relative flex-grow min-w-[14rem] h-56 cursor-pointer ${props.className ?? ""}`} onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)} onClick={props.onClick}>
            <GlowEffect visible={props.selected || hovered}/>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg overflow-hidden blur-none bg-black">
                <BsmImage className={`absolute top-0 left-0 w-full h-full object-cover ${props.type === MSModelType.Avatar ? "object-top" : ""}`} image={thumbnailUrl} placeholder={defaultImage} loading="lazy"/>
                <div className="absolute top-0 right-0 h-full w-0 flex flex-col items-end gap-1 pt-1.5 pr-1.5">
                    {!props.isDownloading ? (
                        actionButtons().map((button, index) => (
                            <BsmButton key={index} className="w-7 h-7 p-1 rounded-md transition-transform duration-150 shadow-black shadow-sm" style={{transitionDelay: `${index * 50}ms`, transform: hovered ? "translate(0%)" : "translate(150%)"}} icon={button.icon} onClick={e => {e.stopPropagation(); e.preventDefault(); button.action();}} withBar={false}/>
                        ))
                    ): (
                        <BsmBasicSpinner className="w-7 h-7 p-1 rounded-md bg-main-color-2 flex items-center justify-center shadow-black shadow-sm" spinnerClassName="brightness-200" thikness="3.5px" style={{color}}/>
                    )}
                </div>
                <motion.div className="absolute cursor-default top-[80%] left-0 w-full h-full p-2 flex flex-col gap-1.5 bg-main-color-3 bg-opacity-60 backdrop-blur-md transition-all delay-150 hover:top-0" onClick={e =>{e.stopPropagation(); e.preventDefault()}}>
                    <BsmLink className={`block w-fit max-w-full overflow-hidden font-bold whitespace-nowrap text-ellipsis ${props.id ? "cursor-pointer hover:underline" : ""}`} href={modelPageUrl}>{props.name}</BsmLink>
                    <BsmLink className={`block w-fit max-w-full overflow-hidden whitespace-nowrap text-ellipsis brightness-200 ${authorPageUrl ? "cursor-pointer hover:underline" : ""}`} style={{color}} href={authorPageUrl}>{props.author ?? ''}</BsmLink>
                    <ul className="flex flex-row flex-wrap gap-1">
                        {modelTags?.map(tag => (
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
};

const typedMemo: <T, P>(c: T, propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean) => T = memo;

export const ModelItem = typedMemo(modelItem, equal);
