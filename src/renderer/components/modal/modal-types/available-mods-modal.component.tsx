import { ModsGrid, modsArrayToCategoryMap } from "renderer/components/version-viewer/slides/mods/mods-grid.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useService } from "renderer/hooks/use-service.hook"
import { ModalComponent } from "renderer/services/modale.service"
import { BeatModsService } from "renderer/services/thrird-partys/beat-mods.service";
import { BSVersionString } from "shared/bs-version.interface"

export const AvailableModsModal: ModalComponent<void, BSVersionString> = ({ data }) => {

    const beatMods = useService(BeatModsService);

    const availableMods = useObservable(() => beatMods.getVersionMods(data), undefined);

    return (
        <div className="h-[85vh] overflow-y-scroll">
           {availableMods && <ModsGrid modsMap={modsArrayToCategoryMap(availableMods)}  />}
        </div>
    )
}
