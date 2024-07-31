import { CSSProperties, ReactNode } from "react";
import { useService } from "renderer/hooks/use-service.hook";
import { LinkOpenerService } from "renderer/services/link-opener.service";

type Props = {
    className?: string;
    href?: string;
    internal?: boolean;
    children?: ReactNode;
    style?: CSSProperties;
};

export function BsmLink({ className, href, children, style, internal }: Props) {

    const linkOpener = useService(LinkOpenerService);

    const openLink = () => {

        if (!href) {
            return;
        }
        linkOpener.open(href, internal);
    };

    return (
        // eslint-disable-next-line jsx-a11y/anchor-is-valid -- Will be reworked later
        <a
            className={`${className} ${href && "cursor-pointer"}`}
            onClick={e => {
                e.stopPropagation();
                openLink();
            }}
            style={style}
        >
            {children}
        </a>
    );
}
