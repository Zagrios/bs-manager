import { LinkOpenerService } from "renderer/services/link-opener.service"
import { ModalService } from "renderer/services/modale.service";
import { IframeModal } from "../modal/modal-types/iframe-modal.component";

type Props = {
    className?: string,
    href?: string,
    internal?: boolean
    children?: React.ReactNode,
    style?: React.CSSProperties
}

export function BsmLink({className, href, children, style, internal}: Props) {

    const linkOpener = LinkOpenerService.getInstance();

    const openLink = () => {
        linkOpener.open(href, internal);
    }

    return (
        <a className={`${className} ${href && "cursor-pointer"}`} onClick={openLink} style={style}>{children}</a>
    )
}
