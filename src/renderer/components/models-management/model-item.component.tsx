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

type Props = {
    className?: string,
    selected?: boolean,
    hash: string,
    onClick?: React.ComponentProps<"li">["onClick"],
} & Partial<MSModel> & Partial<BsmLocalModel>

export const ModelItem = memo(({
    className,
    selected,
    path,
    hash,
    id,
    type,
    name,
    thumbnail,
    author,
    discordid,
    tags,
    onClick
}: Props) => {

    const color = useThemeColor("first-color");
    const [hovered, setHovered] = useState(false);
    const [idContentCopied, setIdContentCopied] = useState<string>(null);

    const modelPageUrl = (() => {
        if(!id){ return null; }
        const url = new URL(MODELS_TYPE_MS_PAGE_ROOT[type], MODEL_SABER_URL);
        url.searchParams.set("id", id.toString());
        return url.toString();
    })();

    const authorPageUrl = (() => {
        if(!discordid){ return null; }
        const url = new URL("Profile", MODEL_SABER_URL);
        url.searchParams.set("user", discordid.toString());
        return url.toString();
    })();

    const copyContent = (value: string, id?: string) => {
        navigator.clipboard.writeText(value);
        setIdContentCopied(() => id);
        setTimeout(() => {
            setIdContentCopied(() => null);
        }, 700);
    }

    return (
        // TODO TRANSLATE ALL TEXT
        <motion.li className={`relative flex-grow min-w-[13rem] h-52 cursor-pointer ${className ?? ""}`} onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)} onClick={onClick}>
            <GlowEffect visible={selected || hovered}/>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg overflow-hidden blur-none">
                <BsmImage className={`absolute top-0 left-0 w-full h-full object-cover ${type === MSModelType.Avatar ? "object-top" : ""}`} image={thumbnail} placeholder={defaultImage} loading="lazy"/>
                <motion.div className="absolute cursor-default top-[80%] left-0 w-full h-full p-2 flex flex-col gap-1.5 bg-main-color-3 bg-opacity-60 backdrop-blur-md transition-all hover:top-0" onClick={e =>{e.stopPropagation(); e.preventDefault()}}>
                    <BsmLink className={`block w-fit max-w-full overflow-hidden font-bold whitespace-nowrap text-ellipsis ${id ? "cursor-pointer hover:underline" : ""}`} href={modelPageUrl}>{name}</BsmLink>
                    <BsmLink className={`block w-fit max-w-full overflow-hidden whitespace-nowrap text-ellipsis brightness-200 ${authorPageUrl ? "cursor-pointer hover:underline" : ""}`} style={{color}} href={authorPageUrl}>{author ?? ''}</BsmLink>
                    <ul className="flex flex-row flex-wrap gap-1">
                        {tags?.map(tag => (
                            <li key={tag} className="inline-block mr-1 text-xs bg-white text-black px-1 rounded-full p-0.5">{tag}</li>
                        ))}
                    </ul>
                    <Tippy placement="top" content={idContentCopied === "hash" ? "Copied!" : "Copy hash"} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                        <span className="mt-0.5 cursor-copy block w-full max-w-fit overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 uppercase text-xs" onClick={() => copyContent(`${hash}`, 'hash')}>{hash}</span>
                    </Tippy>
                        <div className="flex gap-1">
                            {id && (
                                <Tippy placement="top" content={idContentCopied === "id" ? "Copied!" : "Copy id"} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                                    <span className="cursor-copy w-fit shrink-0 max-w-full overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 uppercase text-xs" onClick={() => copyContent(`${id}`, 'id')}>{id}</span>
                                </Tippy>
                            )}
                            {path && (
                                <Tippy placement="top" content={idContentCopied === "path" ? "Copied!" : "Copy path"} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                                    <span className="cursor-copy w-fit max-w-full overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 text-xs" onClick={() => copyContent(`${path}`, 'path')}>{path}</span>
                                </Tippy>
                            )}
                        </div>
                </motion.div>
            </div>
        </motion.li>
    )
}, equal);
