import equal from "fast-deep-equal";
import { memo, useState } from "react";
import { MSModelType } from "shared/models/models/model-saber.model";
import { BsmImage } from "../shared/bsm-image.component";
import { motion } from "framer-motion";
import { GlowEffect } from "../shared/glow-effect.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { MODELS_TYPE_MS_PAGE_ROOT, MODEL_SABER_URL } from "shared/models/models/constants";

type Props = {
    className?: string,
    selected?: boolean,
    // Model props
    modelHash: string,
    modelType: MSModelType,
    modelId?: number,
    modelName: string,
    modelImage?: string,
    modelAuthor?: string,
    modelTags?: string[],
}

export const ModelItem = memo(({
    className,
    selected,
    modelHash,
    modelType,
    modelId,
    modelName,
    modelImage,
    modelAuthor,
    modelTags,
}: Props) => {

    const linkOpener = useConstant(() => LinkOpenerService.getInstance());

    const [hovered, setHovered] = useState(false);

    const openModelPage = () => {
        if(!modelId){ return; }
        const url = new URL(MODELS_TYPE_MS_PAGE_ROOT[modelType], MODEL_SABER_URL);
        url.searchParams.set("id", modelId.toString());
        linkOpener.open(url.toString());
    };

    return (
        <motion.li className={`relative w-52 h-52 cursor-pointer ${className ?? ""}`} onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)}>
            <GlowEffect visible={selected || hovered}/>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg overflow-hidden blur-none">
                <BsmImage className="absolute top-0 left-0 w-full h-full" image={modelImage} loading="lazy"/>
                <motion.div className="absolute cursor-default top-[80%] left-0 w-full h-full p-2 bg-main-color-1 z-[1] bg-opacity-60 backdrop-blur-md transition-all hover:top-0">
                    <h1 className={`w-full max-w-full overflow-hidden font-bold whitespace-nowrap text-ellipsis ${modelId ? "cursor-pointer hover:underline" : ""}`} onClick={openModelPage}>{modelName}</h1>
                </motion.div>
            </div>
        </motion.li>
    )
}, equal);
