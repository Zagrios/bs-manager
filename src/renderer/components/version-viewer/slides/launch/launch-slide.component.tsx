import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BSLauncherService, LaunchMods } from "renderer/services/bs-launcher.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { BSVersion } from "shared/bs-version.interface"
import { LaunchModToogle } from "./launch-mod-toogle.component";

type Props = {version: BSVersion};

export function LaunchSlide({version}: Props) {

    const configService = ConfigurationService.getInstance();
    const bsLauncherService = BSLauncherService.getInstance();

    const [oculusMode, setOculusMode] = useState(!!configService.get<boolean>(LaunchMods.OCULUS_MOD));
    const [desktopMode, setDesktopMode] = useState(!!configService.get<boolean>(LaunchMods.DESKTOP_MOD));
    const [debugMode, setDebugMode] = useState(!!configService.get<boolean>(LaunchMods.DEBUG_MOD));

    const launchState = useObservable(bsLauncherService.launchState$);

    const setMode = (mode: LaunchMods, value: boolean) => {
        if(mode === LaunchMods.DEBUG_MOD){ setDebugMode(value); }
        else if(mode === LaunchMods.OCULUS_MOD){ 
            setOculusMode(value); 
            setDesktopMode(false);
            configService.set(LaunchMods.DESKTOP_MOD, false);
        }
        else if(mode === LaunchMods.DESKTOP_MOD){ 
            setDesktopMode(value); 
            setOculusMode(false);
            configService.set(LaunchMods.OCULUS_MOD, false);
        }
        configService.set(mode, value);
    }

    const launch = () => bsLauncherService.launch(version, version.oculus ? false : oculusMode, desktopMode, debugMode)

    return (
        <div className="w-full shrink-0 items-center relative flex flex-col justify-start">
            <div className='grid grid-flow-col gap-6'>
              {!version.oculus && <LaunchModToogle infoText="pages.version-viewer.launch-mods.oculus-description" icon='oculus' onClick={() => setMode(LaunchMods.OCULUS_MOD, !oculusMode)} active={oculusMode} text="pages.version-viewer.launch-mods.oculus"/>}
              <LaunchModToogle infoText="pages.version-viewer.launch-mods.desktop-description" icon='desktop' onClick={() => setMode(LaunchMods.DESKTOP_MOD, !desktopMode)} active={desktopMode} text="pages.version-viewer.launch-mods.desktop"/>
              <LaunchModToogle infoText="pages.version-viewer.launch-mods.debug-description" icon='terminal' onClick={() => setMode(LaunchMods.DEBUG_MOD, !debugMode)} active={debugMode} text="pages.version-viewer.launch-mods.debug"/>
            </div>
            <div className='grow flex justify-center items-center'>
              <BsmButton onClick={launch} active={JSON.stringify(version) === JSON.stringify(launchState)} className='relative text-5xl text-gray-800 dark:text-gray-200 font-bold tracking-wide pt-1 pb-3 px-7 rounded-lg shadow-md italic shadow-black active:scale-90 transition-transform' text="misc.launch"/>
            </div>
        </div>
    )
}
