import { useEffect, useState } from "react";
import { FilterPanel } from "renderer/components/maps-mangement-components/filter-panel.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { BSV_SORT_ORDER } from "renderer/partials/beat-saver/sort-order";
import { BeatSaverService } from "renderer/services/beat-saver/beat-saver.service";
import { ModalComponent } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";
import { BsvMapDetail, MapFilter } from "shared/models/maps/beat-saver.model";

export const DownloadMapsModal: ModalComponent<void, BSVersion> = ({data}) => {

    const beatSaver = BeatSaverService.getInstance();

    const [filter, setFilter] = useState<MapFilter>(null);
    const [maps, setMaps] = useState<BsvMapDetail[]>(null);
    const [page, setPage] = useState(0);
    const [sortOrder, setSortOrder] = useState(BSV_SORT_ORDER.at(0));

    const sortOptions: BsmSelectOption[] = (() => {
        return BSV_SORT_ORDER.map(sort => ({text: sort, value: sort}));
    })();

    console.log(maps);

    useEffect(() => {
        beatSaver.searchMaps({
            page, sortOrder
        }).then(setMaps);
    }, [])
    

    return (
        <form className="text-gray-800 dark:text-gray-200 flex flex-col">
            <div className="flex h-7 gap-2">
                <BsmDropdownButton className="shrink-0 h-full relative z-[1] flex justify-center" buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1 !bg-main-color-1" icon="search" text="Filtres" withBar={false}>
                    <FilterPanel className="absolute top-[calc(100%+3px)] bg-main-color-3 origin-top w-[500px] h-fit p-2 rounded-md shadow-md shadow-black" filter={filter} onChange={setFilter}/>
                </BsmDropdownButton>
                <input className="h-full bg-main-color-1 rounded-full px-2 grow pb-0.5" type="text" name="" id="" placeholder="Rechercher"/>
                <BsmButton className="shrink-0 aspect-square rounded-full p-1 !bg-main-color-1" icon="search" withBar={false}/>
                <BsmSelect className="bg-main-color-1 rounded-full px-2 pb-0.5" options={sortOptions} onChange={setSortOrder}/>
            </div>
            <ul>
                
            </ul>
        </form>
    )
}
