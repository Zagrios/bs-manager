import { IpcService } from "renderer/services/ipc.service";
import { useService } from "./use-service.hook";
import { useConstant } from "./use-constant.hook";
import { lastValueFrom } from "rxjs";

export function useWindowControls() {
    const ipc = useService(IpcService);

    const { close, maximise, minimise, unmaximise } = useConstant(() => ({
        close: () => lastValueFrom(ipc.sendV2("close-window")),
        maximise: () => lastValueFrom(ipc.sendV2("maximise-window")),
        minimise: () => lastValueFrom(ipc.sendV2("minimise-window")),
        unmaximise: () => lastValueFrom(ipc.sendV2("unmaximise-window"))
    }));

    return { close, maximise, minimise, unmaximise };
}
