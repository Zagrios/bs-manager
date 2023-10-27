import { ModalComponent, ModalExitCode } from "../../../../services/modale.service";
import { OculusIcon } from "renderer/components/svgs/icons/oculus-icon.component";
import { SteamIcon } from "renderer/components/svgs/icons/steam-icon.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BsStore } from "shared/models/bs-store.enum";
import { useState } from "react";
import tailwindConfig from "../../../../../../tailwind.config";
import Color from "color";

export const ChooseStore: ModalComponent<BsStore> = ({ resolver }) => {

    const t = useTranslation();

    const [oculusHover, setOculusHover] = useState(false);
    const [steamHover, setSteamHover] = useState(false);

    const chooseStore = (store: BsStore) => {
        resolver({ exitCode: ModalExitCode.COMPLETED, data: store });
    }

    const isDarkMode = document.documentElement.classList.contains("dark");

    const bg = (() => {
        if(isDarkMode){
            return {
                bright: new Color(tailwindConfig.theme.colors["main-color"][1], "hex").hex(),
                dim: new Color(tailwindConfig.theme.colors["main-color"][1], "hex").darken(.2).hex()
            }
        }

        return {
            bright: new Color(tailwindConfig.theme.colors["main-color"][1], "hex").hex(),
            dim: new Color(tailwindConfig.theme.colors["main-color"][1], "hex").darken(.2).hex()
        }
    })();

    // TODO : Translate

    return (
        <form className="flex flex-col gap-3">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("which platform ?")}</h1>
            <p className="max-w-sm text-gray-800 dark:text-gray-200 text-center">Select the platfrom where you own Beat Saber or from which you want to download it.</p>
            <div className="flex flex-row w-full flex-grow gap-4">
                <div className="flex flex-col flex-grow basis-0 gap-2 text-center px-5 pt-3 pb-1 rounded-md border-main-color-3 border-2 cursor-pointer" onMouseEnter={() => setOculusHover(true)} onMouseLeave={() => setOculusHover(false)} onClick={() => chooseStore(BsStore.OCULUS)} style={{backgroundColor: oculusHover ? bg.dim : bg.bright}}>
                    <OculusIcon className="flex-grow aspect-square text-black bg-white rounded-full p-5"/>
                    <h2 className="font-bold">Oculus Store (PC)</h2>
                </div>
                <div className="flex flex-col flex-grow basis-0 gap-2 text-center px-5 pt-3 pb-1 rounded-md border-main-color-3 border-2 cursor-pointer" onMouseEnter={() => setSteamHover(true)} onMouseLeave={() => setSteamHover(false)} onClick={() => chooseStore(BsStore.STEAM)} style={{backgroundColor: steamHover ? bg.dim : bg.bright}}>
                    <SteamIcon className="flex-grow"/>
                    <h2 className="font-bold">Steam</h2>
                </div>
            </div>
        </form>
    );
};
