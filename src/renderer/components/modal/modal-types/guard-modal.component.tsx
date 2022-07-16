import { ModalExitCode, ModalResponse } from "../../../services/modale.service";
import { useState } from "react";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png"
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export function GuardModal({resolver}: {resolver: (x: ModalResponse) => void}) {

    const [guardCode, setGuardCode] = useState('');
    const t = useTranslation();

    const login = () => {
      if(!guardCode){ return; }
      resolver({exitCode: ModalExitCode.COMPLETED, data: guardCode});
    }

  return (
    <form onSubmit={(e) => {e.preventDefault(); login();}}>
        <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.guard.title")}</h1>
        <BsmImage className="mx-auto h-24" image={BeatConflict}/>
        <div className="mb-4">
            <label className="block font-bold tracking-wide text-gray-800 dark:text-gray-200" htmlFor="guard">{t("modals.guard.inputs.guard-code.label")}</label>
            <input className="w-full bg-light-main-color-1 dark:bg-main-color-1 px-2 rounded-md py-[2px]" onChange={e => setGuardCode(e.target.value.toUpperCase())} value={guardCode} type="guard" name="guard" id="guard" placeholder={t("modals.guard.inputs.guard-code.placeholder")}/>
        </div>
        <div className="grid grid-flow-col grid-cols-2 gap-4">
            <BsmButton className="rounded-md text-center bg-gray-500 hover:brightness-110 transition-all" onClick={() => {resolver({exitCode: ModalExitCode.CANCELED})}} withBar={false} text="misc.cancel"/>
            <BsmButton className="rounded-md text-center bg-blue-500 hover:brightness-110 transition-all" type="submit" withBar={false} text="modals.guard.buttons.submit"/>
        </div>
    </form>
  )
}
