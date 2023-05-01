import { BSVersion } from "shared/bs-version.interface";
import { useState, useRef } from "react";
import { ModelsTabsNavbar } from "./models-tabs-navbar.component";
import { ModelsGrid } from "./models-grid.component";
import { MSModelType } from "shared/models/models/model-saber.model";

export function ModelsPanel({version}: {version?: BSVersion}) {

    const [modelTypeTab, setModelTypeTab] = useState<ModelTabType>(ModelTabType.Avatars);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <div>

            </div>
            <div className="w-full h-full flex flex-row bg-light-main-color-3 dark:bg-main-color-2 rounded-md shadow-black shadow-md overflow-hidden">
                <ModelsTabsNavbar className="flex-shrink-0" version={version} tabIndex={modelTypeTab} onTabChange={setModelTypeTab}/>
                <div className="flex-grow h-full flex flex-col transition-all duration-300" style={{translate: `0 ${0 - modelTypeTab * 100}%`}}>
                    <ModelsGrid version={version} type={MSModelType.Avatar}/>
                    <ModelsGrid version={version} type={MSModelType.Saber}/>
                    <ModelsGrid version={version} type={MSModelType.Platfrom}/>
                    <ModelsGrid version={version} type={MSModelType.Bloq}/>
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
