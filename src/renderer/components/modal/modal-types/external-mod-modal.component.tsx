import { useEffect, useState } from "react";
import Tippy from "@tippyjs/react";
import { useTranslation } from "renderer/hooks/use-translation.hook"

import { useService } from "renderer/hooks/use-service.hook";
import { NotificationService } from "renderer/services/notification.service";

import { ExternalMod, ExternalModFileState, ExternalModFileVerify } from "shared/models/mods/mod.interface"
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"

import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmIcon } from "renderer/components/svgs/bsm-icon.component";
import { BsmTextbox } from "renderer/components/shared/bsm-textbox.component";


export enum ExternalModModalType {
    INSTALL,
    EXISTING,
    UPDATE,
};

export const ExternalModModal: ModalComponent<ExternalMod, {
    name: string;
    version?: string;
    description?: string;
    files: ExternalModFileVerify[]
    type: ExternalModModalType
}> = ({
    resolver,
    options: { data }
}) => {
    const t = useTranslation();

    const notificationService = useService(NotificationService);

    const [name, setName] = useState(data.name);
    const [version, setVersion] = useState(data.version || "");
    const [description, setDescription] = useState(data.description || "");
    const [files, setFiles] = useState([] as ExternalModFileVerify[]);

    const [nameError, setNameError] = useState("");

    const getTooltipMessage = (file: ExternalModFileVerify) => {
        switch (file.state) {
            case ExternalModFileState.SAME_CONFLICT:
                return t("modals.external-mod.file-exists");

            case ExternalModFileState.LOCAL_CONFLICT:
                return t("modals.external-mod.file-local-conflict");

            case ExternalModFileState.API_CONFLICT:
                return t("modals.external-mod.file-api-conflict", {
                    mod: file.conflicts
                });

            default:
                return "";
        }
    }

    useEffect(() => {
        setFiles(data.files);
    }, []);

    const onSubmit = () => {
        if (!name) {
            setNameError("modals.external-mod.name-required");
            return;
        }

        const mod: ExternalMod = {
            name,
            version,
            description,
            enabled: true,
            files: files
                .filter(file => file.state !== ExternalModFileState.API_CONFLICT)
                .map(file => ({
                    id: file.id,
                    name: file.name,
                    folder: file.folder,
                    enabled: file.enabled
                }))
        };

        let hasDll = false;
        for (const file of mod.files) {
            if (file.name.endsWith(".dll")) {
                hasDll = true;
                break;
            }
        }

        if (!hasDll) {
            notificationService.notifyError({
                title: "notifications.mods.external-mod.titles.install-error",
                desc: "notifications.mods.external-mod.msgs.verify-error"
            });
            resolver({ exitCode: ModalExitCode.CANCELED });
            return;
        }

        resolver({ data: mod, exitCode: ModalExitCode.COMPLETED })
    }


    const renderFiles = () => {
        return (
            <div
                className="grid items-center gap-2 max-h-64 overflow-y-auto scrollbar-default px-4 py-2 bg-light-main-color-1 dark:bg-main-color-1"
                style={{
                    gridTemplateColumns: "[first] 20px [line2] auto [line3] 28px [line4] 28px [end]"
                }}
            >
                {files.map(file => (
                    <>
                        <BsmCheckbox
                            className="w-5 h-5 z-[1] relative bg-inherit"
                            checked={file.state === ExternalModFileState.API_CONFLICT
                                ? false
                                : file.enabled}
                            disabled={file.state === ExternalModFileState.API_CONFLICT}
                            onChange={() => {
                                setFiles(files.map(editFile => {
                                    if (editFile.name === file.name) {
                                        editFile.enabled = !file.enabled
                                    }
                                    return editFile;
                                }))
                            }}
                        />

                        <h2 className="font-bold">
                            {window.electron.path.join(file.folder, file.name)}
                        </h2>

                        <div>
                            {file.state !== ExternalModFileState.OK &&
                                <Tippy
                                    className="!bg-main-color-1"
                                    content={getTooltipMessage(file)}
                                    delay={[300, 0]}
                                    arrow={false}
                                >
                                    <div>
                                        <BsmIcon className="text-red-500" icon="cross" />
                                    </div>
                                </Tippy>
                            }
                        </div>

                        <BsmButton
                            className="w-7 h-7 p-[5px] rounded-full group-hover:brightness-90"
                            icon="trash"
                            withBar={false}
                            onClick={event => {
                                event.stopPropagation();
                                setFiles(files.filter(removedFile => removedFile.name !== file.name));
                            }}
                        />
                    </>
                ))}
            </div>
        )
    }

    const renderButtons = () => {
        return (
            <div className="grid grid-flow-col grid-cols-2 gap-4">
                <BsmButton
                    typeColor="cancel"
                    className="rounded-md text-center transition-all"
                    withBar={false}
                    text="misc.cancel"
                    onClick={() => {
                        resolver({ exitCode: ModalExitCode.CANCELED });
                    }}
                />

                <BsmButton
                    type="submit"
                    typeColor="primary"
                    className="z-0 px-1 rounded-md text-center transition-all"
                    withBar={false}
                    text={data.type === ExternalModModalType.INSTALL
                        ? "modals.external-mod.install-button"
                        : "modals.external-mod.update-button"
                    }
                />
            </div>
        );
    }

    return (
        <form onSubmit={event => {
            event.preventDefault();
            onSubmit();
        }}>
            <h1 className="tracking-wide w-full mb-3 uppercase text-3xl text-center text-gray-800 dark:text-gray-200">
                {data.type === ExternalModModalType.UPDATE
                    ? t("modals.external-mod.update-title")
                    : t("modals.external-mod.install-title")
                }
            </h1>

            {data.type === ExternalModModalType.EXISTING &&
                <h2 className="mb-1 text-center font-bold tracking-wide text-red-500">
                    {t("modals.external-mod.existing")}
                </h2>
            }

            <BsmTextbox
                label="modals.external-mod.name"
                description={nameError}
                descriptionClassName="mb-1 font-bold text-sm text-red-500 tracking-wide"
                tabIndex={0}
                value={name}
                onChange={(val) => {
                    setNameError("");
                    setName(val);
                }}
            />
            <BsmTextbox
                label="modals.external-mod.version"
                tabIndex={0}
                value={version}
                onChange={setVersion}
            />
            <BsmTextbox
                label="modals.external-mod.description"
                tabIndex={0}
                value={description}
                onChange={setDescription}
            />

            <div className="mb-3">
                <h1 className="mb-2 text-2xl font-bold tracking-wide">
                    {t("modals.external-mod.files")}
                </h1>

                {renderFiles()}
            </div>

            {renderButtons()}

        </form>
    )
}
