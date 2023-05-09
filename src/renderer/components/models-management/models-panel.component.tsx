import { BSVersion } from "shared/bs-version.interface";
import { useRef, useState, MutableRefObject } from "react";
import { ModelsTabsNavbar } from "./models-tabs-navbar.component";
import { ModelsGrid } from "./models-grid.component";
import { MSModelType } from "shared/models/models/model-saber.model";
import { BsmDropdownButton, DropDownItem } from "../shared/bsm-dropdown-button.component";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";

export function ModelsPanel({version}: {version?: BSVersion}) {

    const modelsManager = useConstant(() => ModelsManagerService.getInstance());
    const [avatarsRef, sabersRef, platformsRef, bloqsRef] = [useRef(null), useRef(null), useRef(null), useRef(null)];
    const [modelTypeTab, setModelTypeTab] = useState<ModelTabType>(ModelTabType.Avatars);

    console.log(modelTypeTab);

    const getSelectedModels = (ref?: MutableRefObject<any>) => {
        if(ref){ return (ref.current?.getSelectedModels() as BsmLocalModel[]); }
        return [avatarsRef, sabersRef, platformsRef, bloqsRef].map(ref =>(ref.current?.getSelectedModels() as BsmLocalModel[])).flat()
    };
    const getAllModels = (ref?: MutableRefObject<any>) => {
        if(ref){ return (ref.current?.getModels() as BsmLocalModel[]); }
        return [avatarsRef, sabersRef, platformsRef, bloqsRef].map(ref =>(ref.current?.getModels() as BsmLocalModel[])).flat();
    }
    const reloadModels = (ref?: MutableRefObject<any>) => {
        if(ref){ return (ref.current?.reloadModels()); }
        return [avatarsRef, sabersRef, platformsRef, bloqsRef].forEach(ref => ref.current?.reloadModels())
    };
    
    const getActiveTabRef = (activeTab: ModelTabType) => [avatarsRef, sabersRef, platformsRef, bloqsRef][modelTypeTab];

    const exportModels = () => {
        modelsManager.exportModels(getSelectedModels(), version);
    }

    const deleteModels = () => {
        const activeTab = getActiveTabRef(modelTypeTab);
        const models = getSelectedModels(activeTab)?.length ? getSelectedModels(activeTab) : getAllModels(activeTab);
        modelsManager.deleteModels(models, version).then(deleted => {
            if(!deleted){ return; }
            reloadModels(activeTab);
        });
    }

    const threeDotsItems: DropDownItem[] = [
        {text: "TODO TRANSLATE EXPORT", onClick: exportModels, icon: "export"},
        {text: "TODO TRANSLATE DELETE", onClick: deleteModels, icon: "trash"},
    ];

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="w-full shrink-0 flex h-9 justify-center px-40 gap-2 mb-3 text-main-color-1 dark:text-white">
                <div className="h-full rounded-full bg-light-main-color-2 dark:bg-main-color-2 grow p-[6px]">
                    <input type="text" className="h-full w-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2" placeholder={"TODO TRANSLATE"}  tabIndex={-1}/>
                </div>
                <BsmDropdownButton items={threeDotsItems} className="h-full flex aspect-square relative rounded-full z-[1] bg-light-main-color-1 dark:bg-main-color-3" buttonClassName="rounded-full h-full w-full p-[6px]" icon="three-dots" withBar={false} menuTranslationY="6px" align="center"/>
            </div>
            <div className="w-full h-full flex flex-row bg-light-main-color-3 dark:bg-main-color-2 rounded-md shadow-black shadow-md overflow-hidden">
                <ModelsTabsNavbar className="flex-shrink-0" version={version} tabIndex={modelTypeTab} onTabChange={setModelTypeTab}/>
                
                <div className="flex-grow h-full flex flex-col transition-all duration-300" style={{translate: `0 ${0 - modelTypeTab * 100}%`}}>
                    <ModelsGrid ref={avatarsRef} version={version} type={MSModelType.Avatar}/>
                    <ModelsGrid ref={sabersRef} version={version} type={MSModelType.Saber}/>
                    <ModelsGrid ref={platformsRef} version={version} type={MSModelType.Platfrom}/>
                    <ModelsGrid ref={bloqsRef} version={version} type={MSModelType.Bloq}/>
                </div>
            </div>
        </div>
    )
}

enum ModelTabType {
    Avatars = 0,
    Sabers = 1,
    Platforms = 2,
    Bloqs = 3,
}
