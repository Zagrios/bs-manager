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

type Props = {
    className?: string,
    selected?: boolean,
    hash: string,
} & Partial<MSModel>

export const ModelItem = memo(({
    className,
    selected,
    hash,
    id,
    type,
    name,
    thumbnail,
    author,
    discord,
    discordid,
    tags
}: Props) => {

    const color = useThemeColor("first-color");
    const [hovered, setHovered] = useState(false);

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

    return (
        <motion.li className={`relative w-52 h-52 cursor-pointer ${className ?? ""}`} onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)}>
            <GlowEffect visible={selected || hovered}/>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg overflow-hidden blur-none">
                <BsmImage className="absolute top-0 left-0 w-full h-full" image={thumbnail} loading="lazy"/>
                <motion.div className="absolute cursor-default top-[80%] left-0 w-full h-full p-2 flex flex-col gap-1.5 bg-main-color-2 z-[1] bg-opacity-60 backdrop-blur-md transition-all hover:top-0">
                    <BsmLink className={`block w-full max-w-full overflow-hidden font-bold whitespace-nowrap text-ellipsis ${id ? "cursor-pointer hover:underline" : ""}`} href={modelPageUrl}>{name}</BsmLink>
                    <BsmLink className={`block w-full max-w-full overflow-hidden whitespace-nowrap text-ellipsis brightness-200 ${authorPageUrl ? "cursor-pointer hover:underline" : ""}`} style={{color}} href={authorPageUrl}>{author ?? ''}</BsmLink>
                    <ul className="flex flex-row flex-wrap gap-1">
                        {tags?.map(tag => (
                            <li key={tag} className="inline-block mr-1 text-xs bg-white text-black px-1 rounded-full p-0.5">{tag}</li>
                        ))}
                    </ul>
                    <Tippy placement="top" content="Copy hash" followCursor="horizontal" plugins={[followCursor]}>
                        <div className="cursor-copy block w-full max-w-full overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-2 rounded-md p-1 uppercase text-sm pointer-events-auto">{hash}</div>
                    </Tippy>
                </motion.div>
            </div>
        </motion.li>
    )
}, equal);
