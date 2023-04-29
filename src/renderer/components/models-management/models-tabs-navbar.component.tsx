import { BSVersion } from "shared/bs-version.interface"
import { TabNavBar } from "../shared/tab-nav-bar.component"
import { MSModelType } from "shared/models/model-saber/model-saber.model"
import { LinkButton } from "../maps-mangement-components/link-button.component"
import { Variants } from "framer-motion"
import { DetailedHTMLProps, useEffect, useState } from "react"
import { useTranslation } from "renderer/hooks/use-translation.hook"
import { useThemeColor } from "renderer/hooks/use-theme-color.hook"
import { useOnUpdate } from "renderer/hooks/use-on-update.hook"
import { useConstant } from "renderer/hooks/use-constant.hook"
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service"

type Props = {
    version?: BSVersion
    tabIndex: number,
    onTabChange: (index: number) => void
}

export function ModelsTabsNavbar({version, tabIndex, onTabChange}: Props) {

    const renderTab = (props: DetailedHTMLProps<React.HTMLAttributes<any>, any>, text: string, index?: number) => {
        return <ModelTab version={version} index={index} modelType={Object.values(MSModelType).at(index)} onClick={props.onClick}/>
    }

    return (
        <TabNavBar className="!rounded-none shadow-sm" tabsText={
            ["Avatars", "Sabers", "Platforms", "Bloqs"]
        } tabIndex={tabIndex} onTabChange={onTabChange} renderTab={renderTab}/>
    )
}

type TabProps = {
    version?: BSVersion,
    modelType: MSModelType,
    index: number,
    onLink?: (type: MSModelType) => void,
    onUnlink?: (type: MSModelType) => void,
} & DetailedHTMLProps<React.HTMLAttributes<HTMLLIElement>, HTMLLIElement>;

function ModelTab({version, modelType, onClick, onLink, onUnlink}: TabProps){

    const modelsManager = useConstant(() => ModelsManagerService.getInstance());

    const [modelsAreLinked, setModelsAreLinked] = useState(false);
    const [linkBtnDisabled, setLinkBtnDisabled] = useState(false);

    useOnUpdate(() => {
        if(!version){ return; }

        const sub = modelsManager.$modelsLinkingPending(version, modelType).subscribe(async (pending) => {
            if(pending){ return setLinkBtnDisabled(() => pending); }
            const modelsLinked = await modelsManager.isModelsLinked(version, modelType);
            setModelsAreLinked(() => modelsLinked);
            setLinkBtnDisabled(() => pending);
        });

        return () => {
            sub.unsubscribe();
        }
    }, [version]);

    const linkModels = () => modelsManager.linkModels(modelType, version).then(() => onLink?.(modelType));
    const unlinkModels = () => modelsManager.unlinkModels(modelType, version).then(() => onUnlink?.(modelType));
    
    const onClickLink = () => {
        if(!version){ return Promise.resolve(); }
        if(modelsAreLinked){ return unlinkModels(); }
        return linkModels();
    }

    return (
        <li className="relative text-center text-lg font-bold hover:backdrop-brightness-75 flex justify-center items-center content-center" onClick={onClick}>
            <span className="text-main-color-1 dark:text-gray-200">{modelType}</span>
                <div className="h-full flex absolute right-0 top-0 gap-1.5 items-center pr-2">
                    {!!version && (
                        <LinkButton 
                            variants={{ hover: {rotate: 22.5}, tap: {rotate: 45} }}
                            disabled={linkBtnDisabled}
                            whileHover="hover" 
                            whileTap="tap" 
                            initial={{rotate: 0}} 
                            className="block p-0.5 h-[calc(100%-5px)] aspect-square blur-0 hover:brightness-75" 
                            linked={modelsAreLinked} 
                            title={"aaa"} 
                            onClick={onClickLink}
                        />
                    )}
                </div>
            </li>
    )

}
