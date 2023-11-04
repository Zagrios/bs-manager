import { ModalComponent, ModalExitCode } from "../../../../services/modale.service";
import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { MetaIcon } from "renderer/components/svgs/icons/meta-icon.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";

export const LoginToMetaModal: ModalComponent<boolean> = ({ resolver }) => {

    const t = useTranslation();

    const [stay, setStay] = useState(false);

    const submit = () => {
        resolver({ exitCode: ModalExitCode.COMPLETED, data: stay });
    };

    return (
        <form className="flex flex-col justify-center items-center w-96 gap-4">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">Connect to Meta</h1>

            {/* <BsmImage className="mx-auto h-24" image={BeatConflict} /> */}
            <div className="flex justify-center items-center h-28 aspect-square bg-white rounded-full p-4">
                <MetaIcon className="w-full h-full"/>
            </div>

            <p>
                <b>Votre token de connexion à Meta est nécéssaire pour télécharger Beat Saber.</b>
            </p>
        {/* TODO : Translate */}
            <p>
                En vous connectant à Meta, une fenètre de connexion s'ouvrira et vous pourrez alors débuter le processus de connexion.
                Veuillez à bien accepter les cookies sinon quoi, il se pourrait que l'on arrive pas à récupérer votre token de connexion pour démarrer le téléchargement.
            </p>

            <div className="w-full flex flex-row justify-start items-center gap-1.5">
                <BsmCheckbox className="relative z-[1] w-6 aspect-square" checked={stay} onChange={enable => setStay(() => enable)}/>
                <span>{t("modals.steam-login.inputs.stay")}</span>
            </div>

            <BsmButton className="rounded-md flex justify-center items-center transition-all h-10 w-full" typeColor="primary" text="Connect to Meta" withBar={false} onClick={submit}/>
        </form>
    );
};
