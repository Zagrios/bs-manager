import { BSVersion } from "shared/bs-version.interface";
import { MSModelType } from "../../../shared/models/models/model-saber.model";
import { LinkButton } from "../maps-mangement-components/link-button.component";
import { useState } from "react";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { BsContentNavBar, BsContentNavBarTab } from "../shared/bs-content-nav-bar.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { MODEL_TYPES } from "../../../shared/models/models/constants";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";

type Props = {
    className?: string;
    version?: BSVersion;
    tabIndex: number;
    onTabChange: (index: number, tab: BsContentNavBarTab<MSModelType>) => void;
};

export function ModelsTabsNavbar({ className, version, tabIndex, onTabChange }: Props) {
    const tabs = useConstant<BsContentNavBarTab<MSModelType>[]>(() => {
        return MODEL_TYPES.map(type => ({
            text: type,
            extra: type,
        }));
    });

    return <BsContentNavBar className={`!rounded-none shadow-sm ${className ?? ""}`} tabIndex={tabIndex} onTabChange={onTabChange} tabs={tabs} renderTab={(props, tab, activeTab) => <ModelTab version={version} modelType={tab.extra} {...props} active={tab === activeTab} />} />;
}

type TabProps = {
    version?: BSVersion;
    modelType: MSModelType;
    active?: boolean;
} & React.ComponentProps<"li">;

function ModelTab({ version, modelType, active, onClick }: TabProps) {
    const modelsManager = useService(ModelsManagerService);

    const t = useTranslation();

    const [modelsAreLinked, setModelsAreLinked] = useState(false);
    const [linkBtnDisabled, setLinkBtnDisabled] = useState(false);

    useOnUpdate(() => {
        if (!version) {
            return;
        }

        const sub = modelsManager.$modelsLinkingPending(version, modelType).subscribe(async pending => {
            if (pending) {
                return setLinkBtnDisabled(() => pending);
            }
            const modelsLinked = await modelsManager.isModelsLinked(version, modelType);
            setModelsAreLinked(() => modelsLinked);
            setLinkBtnDisabled(() => pending);
        });

        return () => {
            sub.unsubscribe();
        };
    }, [version]);

    const linkModels = () => modelsManager.linkModels(modelType, version);
    const unlinkModels = () => modelsManager.unlinkModels(modelType, version);

    const onClickLink = () => {
        if (!version) {
            return Promise.resolve();
        }
        if (modelsAreLinked) {
            return unlinkModels();
        }
        return linkModels();
    };

    return (
        <li className={`relative w-full cursor-pointer flex-1 text-center text-lg font-bold flex justify-center items-center content-center px-7 dim-on-hover ${active ? "dim" : ""}`} onClick={onClick}>
            <div className="flex flex-col gap-0.5 justify-start items-center text-main-color-1 dark:text-gray-200">
                <BsmIcon icon={modelType} className="w-7 h-7" />
                <span className=" font-thin italic text-xs">{t(`models.types.plural.${modelType}`)}</span>
            </div>
            <div className="flex items-center absolute top-1.5 left-1.5">{!!version && <LinkButton variants={{ hover: { rotate: 22.5 }, tap: { rotate: 45 } }} disabled={linkBtnDisabled} whileHover="hover" whileTap="tap" initial={{ rotate: 0 }} className="block w-6 h-6 aspect-square blur-0 cursor-pointer hover:brightness-75" linked={modelsAreLinked} title={modelsAreLinked ? "models.panel.actions.unlink-models" : "models.panel.actions.link-models"} onClick={onClickLink} />}</div>
        </li>
    );
}
