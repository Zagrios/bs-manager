import { LinkOpenerService } from "renderer/services/link-opener.service"

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
        if(!href){ return; }
        linkOpener.open(href, internal);
    }

    return (
        <a className={`${className} ${href && "cursor-pointer"}`} onClick={e => {e.stopPropagation(); openLink()}} style={style}>{children}</a>
    )
}
