import { BSVersion } from "shared/bs-version.interface";
import { useState } from "react";
import { ModelsTabsNavbar } from "./models-tabs-navbar.component";

export function ModelsPanel({version}: {version?: BSVersion}) {

    const [modelTypeTab, setModelTypeTab] = useState<ModelTabType>(ModelTabType.Avatars);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <div>

            </div>
            <div className="w-full h-full flex flex-col bg-light-main-color-3 dark:bg-main-color-2 rounded-md shadow-black shadow-md overflow-hidden">
                <ModelsTabsNavbar version={version} tabIndex={modelTypeTab} onTabChange={setModelTypeTab}/>
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
