import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import VisibilitySensor  from 'react-visibility-sensor';
import { Mod } from "shared/models/mods/mod.interface";
import { ModsGrid } from "./mods-grid.component";
import { ConfigurationService } from "renderer/services/configuration.service";
import { DefaultConfigKey } from "renderer/config/default-configuration.config";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import BeatWaitingImg from "../../../../../../assets/images/apngs/beat-waiting.png"
import { SpoilerClick } from "renderer/components/shared/UwU/spoiler-click.component";
import YuruYuriDance from "../../../../../../assets/images/gifs/yuruyuri-dance.gif"
import { useObservable } from "renderer/hooks/use-observable.hook";
import { skip, filter } from "rxjs/operators";
import { Subscription } from "rxjs";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { LinkOpenerService } from "renderer/services/link-opener.service";
 
export function ModsSlide({version}: {version: BSVersion}) {

    const modsManager = BsModsManagerService.getInstance();
    const configService = ConfigurationService.getInstance();
    const linkOpener = LinkOpenerService.getInstance();

    const [isVisible, setIsVisible] = useState(false);
    const [modsAvailable, setModsAvailable] = useState(null as Map<string, Mod[]>);
    const [modsInstalled, setModsInstalled] = useState(null as Map<string, Mod[]>);
    const [modsSelected, setModsSelected] = useState([] as Mod[]);
    const [moreInfoMod, setMoreInfoMod] = useState(null as Mod);
    const installing = useObservable(modsManager.isInstalling$);
    const t  = useTranslation();

    const downloadRef = useRef(null);
    const [downloadWith, setDownloadWidth] = useState(0);

    const modsToCategoryMap = (mods: Mod[]): Map<string, Mod[]> => {
        if(!mods){ return new Map<string, Mod[]>(); }
        const map = new Map<string, Mod[]>();
        mods.forEach(mod => map.set(mod.category, [...map.get(mod.category) ?? [], mod]));
        return map;
    }

    const handleModChange = (selected: boolean, mod: Mod) => {
        if(selected){ return setModsSelected([...modsSelected, mod]); }
        const mods = [...modsSelected];
        mods.splice(mods.findIndex(m => m.name === mod.name), 1);
        setModsSelected(mods);
    }

    const handleMoreInfo = (mod: Mod) => {
        if(mod.name === moreInfoMod?.name){ return setMoreInfoMod(null); }
        setMoreInfoMod(mod);
    }

    const handleOpenMoreInfo = () => {
        if(!moreInfoMod || !moreInfoMod.link){ return; }
        linkOpener.open(moreInfoMod.link);
    }

    const installMods = () => {
        if(installing){ return; }
        modsManager.installMods(modsSelected, version).then(() => {
            loadMods();
        });
    }

    const loadMods = () => {
        Promise.all([
            modsManager.getAvailableMods(version),
            modsManager.getInstalledMods(version)
        ]).then(([available, installed]) => {
            const defaultMods = configService.get<string[]>("default_mods" as DefaultConfigKey);
            setModsAvailable(modsToCategoryMap(available));
            setModsSelected(available.filter(m => m.required || defaultMods.some(d => m.name.toLowerCase() === d.toLowerCase()) || installed.some(i => m.name === i.name)));
            setModsInstalled(modsToCategoryMap(installed))
        });
    }

    useEffect(() => {

        const subs: Subscription[] = [];

        if(isVisible){
            loadMods();
            subs.push(modsManager.isUninstalling$.pipe(skip(1), filter(uninstalling => !uninstalling)).subscribe(() => {
                loadMods();
            }))
        }

        return () => {
            setMoreInfoMod(null);
            setModsAvailable(null);
            setModsInstalled(null);
            subs.forEach(s => s.unsubscribe());
        }
        
    }, [isVisible, version]);
    

    useLayoutEffect(() => {
        if(modsAvailable){
            setDownloadWidth(downloadRef?.current?.offsetWidth)
        }
    }, [modsAvailable])
    

    return (
        <VisibilitySensor onChange={setIsVisible}>
            <div className='shrink-0 w-full h-full px-8 pb-7 flex justify-center'>
                <div className='relative flex flex-col grow-0 bg-light-main-color-2 dark:bg-main-color-2 h-full w-full rounded-md shadow-black shadow-center overflow-hidden'>
                    {modsAvailable ? (
                        <>
                            <div className="overflow-scroll w-full min-h-0 scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-thumb-rounded-full">
                                <ModsGrid modsMap={modsAvailable} installed={modsInstalled} modsSelected={modsSelected} onModChange={handleModChange} moreInfoMod={moreInfoMod} onWantInfos={handleMoreInfo}/>
                            </div>
                            <div className="h-10 shrink-0 flex items-center justify-between px-3">
                                <BsmButton className="text-center rounded-md px-2 py-[2px]" text="pages.version-viewer.mods.buttons.more-infos" typeColor="cancel" withBar={false} disabled={!moreInfoMod} onClick={handleOpenMoreInfo} style={{width: downloadWith}}/>
                                <div ref={downloadRef}>
                                    <BsmButton className="text-center rounded-md px-2 py-[2px]" text="pages.version-viewer.mods.buttons.install-or-update" withBar={false} disabled={installing} typeColor="primary" onClick={installMods}/>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center relative">
                            <img className="w-32 h-32 spin-loading" src={BeatWaitingImg}></img>
                            <span className="text-xl mt-3 h-0 italic">{t("pages.version-viewer.mods.loading-mods")}</span>
                            <SpoilerClick className="absolute right-5 w-20 h-[120px] bottom-5 cursor-pointer">
                                <img className="relative w-full" src={YuruYuriDance}/>
                            </SpoilerClick>
                        </div>
                    )}
                </div>
            </div>
        </VisibilitySensor>
        
    )
}
