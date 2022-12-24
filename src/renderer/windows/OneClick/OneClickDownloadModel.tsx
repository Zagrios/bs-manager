import { useEffect, useState } from "react";
import { IpcService } from "renderer/services/ipc.service";
import { ThemeService } from "renderer/services/theme.service";
import { ModelSaberService } from "renderer/services/thrird-partys/model-saber.service";
import { MSModel } from "shared/models/model-saber/model-saber.model";

export default function OneClickDownloadModel() {

    const ipc = IpcService.getInstance();
    const themeService = ThemeService.getInstance();
    const modelSaber = ModelSaberService.getInstance();

    const [model, setModel] = useState<MSModel>(null);

    useEffect(() => {
      
        const sub = themeService.theme$.subscribe(() => {
            if(themeService.isDark || (themeService.isOS && window.matchMedia('(prefers-color-scheme: dark)').matches)){ document.documentElement.classList.add('dark'); }
            else { document.documentElement.classList.remove('dark'); }
        });

        const promise = new Promise(async (resolve, reject) => {

            const infos = await ipc.send<{id: string, type: string}>("one-click-model-info");

            if(!infos.success){ reject(); }

            const model = await modelSaber.getModelById(infos.data.id);
            
            setModel(() => model);

            // Download model

        });

        return () => {
            sub.unsubscribe();
        }
    }, [])
    

    return (
        <div>OneClickDownloadModel</div>
    )
}
