import { useRef, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { cn } from "renderer/helpers/css-class.helpers";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { PlaylistSearchParams, BsvSearchOrder } from "shared/models/maps/beat-saver.model";
import { DownloadPlaylistFilterPanel, FilterPlaylistSearchParams } from "./download-playlist-filter-panel.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";

type Props = {
    className?: string;
    value?: Omit<PlaylistSearchParams, "page">
    onSubmit?: (value: Omit<PlaylistSearchParams, "page">) => void;
}

export function DownloadPlaylistModalHeader({ className, value, onSubmit }: Props) {

    const t = useTranslation();
    const dropDownFilterRef = useRef(null);

    const [query, setQuery] = useState<string>(value?.q || "");
    const [order, setOrder] = useState<BsvSearchOrder>(value?.sortOrder || BsvSearchOrder.Relevance);
    const [filter, setFilter] = useState<FilterPlaylistSearchParams>({});

    const searchParams: Omit<PlaylistSearchParams, "page"> = { q: query, sortOrder: order };

    const sortOptions: BsmSelectOption<BsvSearchOrder>[] = useConstant(() => {
        return Object.values(BsvSearchOrder).reduce((acc, value) => {
            if(value === BsvSearchOrder.Rating){ return acc; }
            acc.push({ text: `beat-saver.maps-sorts.${value}`, value });
            return acc;
        }, []);
    });

    const handleOrderChange = (value: BsvSearchOrder) => {
        setOrder(() => value);
        submit({...searchParams, sortOrder: value})
    };

    const handleFilterSubmit = (value: FilterPlaylistSearchParams) => {
        setFilter(() => value);
        submit({...searchParams, ...value});
        dropDownFilterRef.current?.close?.();
    };

    const submit = (value: Omit<PlaylistSearchParams, "page">) => {
        if(!onSubmit){ return; }
        onSubmit(value);
    };

    return (
        <form className={cn('flex flex-row gap-2', className)} onSubmit={e => {e.preventDefault(); submit(searchParams);}}>
            <BsmDropdownButton ref={dropDownFilterRef} buttonClassName="flex items-center justify-center h-full rounded-full px-2 py-1 !bg-light-main-color-1 dark:!bg-main-color-1" icon="filter" text="pages.version-viewer.maps.search-bar.filters-btn" withBar={false}>
                <DownloadPlaylistFilterPanel className="z-10 translate-y-1" params={filter} onSubmit={handleFilterSubmit}/>
            </BsmDropdownButton>
            <input className="h-full bg-theme-1 rounded-full px-2 grow pb-0.5" type="text" placeholder={t("playlist.search-playlist")} value={query} onChange={e => setQuery(e.target.value)} />
            <BsmButton className="shrink-0 rounded-full py-1 px-3 !bg-theme-1 flex justify-center items-center capitalize" icon="search" text="modals.download-maps.search-btn" withBar={false} onClick={() => submit(searchParams)} />
            <BsmSelect className="bg-theme-1 rounded-full px-1 pb-0.5 text-center cursor-pointer" options={sortOptions} selected={order} onChange={handleOrderChange}/>
        </form>
    )
}
