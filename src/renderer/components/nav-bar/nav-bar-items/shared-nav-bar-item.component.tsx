import { Link } from "react-router-dom";
import { BsmIcon } from "renderer/components/svgs/bsm-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { PageStateService } from "renderer/services/page-state.service";
import { NavBarItem } from "./nav-bar-item.component";
import { useService } from "renderer/hooks/use-service.hook";
import Tippy from "@tippyjs/react";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export function SharedNavBarItem() {
    const pageState = useService(PageStateService);

    const t = useTranslation();
    const route = useObservable(pageState.route$);
    const color = useThemeColor("first-color");

    return (
        <NavBarItem isActive={route === "/shared"}>
            <Tippy content={t("nav-bar.shared.tooltip")} className="font-bold !bg-neutral-900" placement="right-end" arrow={false} duration={[100, 0]} animation="shift-away-subtle">
                <Link to="shared" className="w-full flex items-center justify-start content-center max-w-full h-[30px]">
                    <BsmIcon className="w-[19px] h-[19px] mr-[5px] shrink-0 brightness-125" icon="link" style={{ color }} />
                    <span className="dark:text-gray-200 text-gray-800 font-bold tracking-wide">{t("nav-bar.shared.text")}</span>
                </Link>
            </Tippy>
        </NavBarItem>
    );
}
