import { CSSProperties } from "react";
import { Supporter } from "shared/models/supporters";
import { motion } from "framer-motion";
import txtBg from "../../../../../assets/images/gifs/txt-bg.gif";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { useService } from "renderer/hooks/use-service.hook";

interface Props {
    supporter: Supporter;
    delay?: number;
}

export function SupporterItem({ supporter, delay }: Props) {
    const linkOpener = useService(LinkOpenerService);

    const openSupporterLink = () => supporter.link && linkOpener.open(supporter.link);

    const additionnalStyles: CSSProperties = (() => {
        const commonStyles: CSSProperties = { backgroundImage: `url(${txtBg})`, backgroundRepeat: "no-repeat", backgroundPosition: "center" };
        if (supporter.type === "gold") {
            return { color: "#ffe270", textShadow: "0px 0px 10px #ffdd59", backgroundSize: "70% 15px", ...commonStyles };
        }
        if (supporter.type === "diamond") {
            return { color: "#0ef2f8", textShadow: "0px 0px 15px #0ef2f8", backgroundSize: "70% 19px", ...commonStyles };
        }
        if (supporter.type === "sponsor") {
            return { color: "#0be881", textShadow: "0px 0px 15px #0be881", backgroundSize: "70% 19px", ...commonStyles };
        }
        return {};
    })();

    const renderSpan = () => {
        return (
            <motion.span className={`text-2xl font-bold px-3 pb-1 ${supporter.link && "cursor-pointer underline"}`} style={additionnalStyles} onClick={openSupporterLink} initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay }}>
                {supporter.username}
            </motion.span>
        );
    };

    const renderItem = () => {
        if (supporter.type !== "sponsor") {
            return renderSpan();
        }
        return (
            <motion.div className={`flex flex-col justify-center items-center mx-4 ${supporter.link && "cursor-pointer underline"}`} onClick={openSupporterLink} initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay }}>
                <img className="max-w-xs max-h-52 mb-2" src={supporter.img} />
                {renderSpan()}
            </motion.div>
        );
    };

    return renderItem();
}
