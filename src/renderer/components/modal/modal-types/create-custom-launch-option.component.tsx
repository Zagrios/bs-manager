import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import BeatRunning from "../../../../../assets/images/apngs/beat-running.png";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { CustomLaunchOption } from "renderer/components/version-viewer/slides/launch/launch-options-panel.component";
import { FormEvent, useState } from "react";
import { useConstant } from "renderer/hooks/use-constant.hook";

type Data = Partial<CustomLaunchOption>;

export const CreateCustomLaunchOptionModal: ModalComponent<CustomLaunchOption, Data> = ({resolver, options}) => {
    const { text: t } = useTranslationV2();

    const uid = useConstant(() => options?.data?.id ?? crypto.randomUUID());
    const [name, setName] = useState(options?.data?.label ?? "");
    const [command, setCommand] = useState(options?.data?.data?.command ?? "");

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        resolver({
            exitCode: ModalExitCode.COMPLETED,
            data: {
                id: uid,
                label: name,
                data: {
                    command,
                }
            }
        });
    }

    const cancel = () => {
        resolver({
            exitCode: ModalExitCode.CANCELED,
            data: null,
        });
    }

    return (
        <form onSubmit={onSubmit} className="max-w-xs">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.custom-launch-option.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatRunning} />
            <p className="mb-2">{t("modals.custom-launch-option.desc")}</p>
            <div className="flex flex-col gap-px mb-3">
                <label className="font-bold cursor-pointer tracking-wide inline-block w-fit" htmlFor="name">{t("modals.custom-launch-option.name")}</label>
                <input className="h-8 px-1.5 bg-light-main-color-1 dark:bg-main-color-1 rounded-md" type="text" id="name" required value={name} onChange={e => setName(e.target.value)} placeholder={t("modals.custom-launch-option.title-placeholder")} />
            </div>
            <div className="flex flex-col gap-px mb-3">
                <label className="font-bold cursor-pointer tracking-wide inline-block w-fit" htmlFor="launch-option">{t("modals.custom-launch-option.launch-option")}</label>
                <input className="h-8 px-1.5 bg-light-main-color-1 dark:bg-main-color-1 rounded-md" type="text" id="launch-option" required value={command} onChange={e => setCommand(e.target.value)} placeholder="--launch-option" />
            </div>
            <div className="flex gap-3">
                <BsmButton className="rounded-md flex justify-center items-center transition-all h-10 grow shrink-0" text={t("misc.cancel")} typeColor="cancel" withBar={false} onClick={cancel}/>
                <BsmButton className="rounded-md flex justify-center items-center transition-all h-10 grow shrink-0" type="submit" text={t("misc.create")} typeColor="primary" withBar={false} />
            </div>

        </form>
    )
};
