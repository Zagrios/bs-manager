import { BsmImage } from "../../shared/bsm-image.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsmLink } from "../../shared/bsm-link.component";
import { BsmIcon } from "../../svgs/bsm-icon.component";
import { BsmButton } from "../../shared/bsm-button.component";
import { AnimatePresence, motion } from "framer-motion";
import { useState, Fragment, useRef } from "react";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import dateFormat from "dateformat";
import { AudioPlayerService } from "renderer/services/audio-player.service";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { map } from "rxjs/operators";
import equal from "fast-deep-equal/es6";
import { BsmBasicSpinner } from "../../shared/bsm-basic-spinner/bsm-basic-spinner.component";
import defaultImage from "../../../../../assets/images/default-version-img.jpg";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { MAP_DIFFICULTIES_COLORS } from "shared/models/maps/difficulties-colors";
import useDoubleClick from "use-double-click";
import { GlowEffect } from "../../shared/glow-effect.component";
import { useDelayedState } from "renderer/hooks/use-delayed-state.hook";
import { useService } from "renderer/hooks/use-service.hook";
import Tippy from "@tippyjs/react";
import { SongDetailDiffCharactertistic, SongDiffName } from "shared/models/maps";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { CalendarDateTime, getLocalTimeZone } from "@internationalized/date";
import { typedMemo } from "renderer/helpers/typed-memo";
import { Observable, of } from "rxjs";
import { ParsedMapDiff } from "shared/mappers/map/map-item-component-props.mapper";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BPListDifficulty } from "shared/models/playlists/playlist.interface";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { cn } from "renderer/helpers/css-class.helpers";

export type MapItemComponentProps<T = unknown> = {
    hash: string;
    title: string;
    autor: string;
    songAutor?: string;
    coverUrl?: string;
    songUrl?: string;
    autorId: number;
    mapId: string;
    diffs: Map<SongDetailDiffCharactertistic, ParsedMapDiff[]>;
    highlightedDiffs?: BPListDifficulty[];
    ranked?: boolean;
    blRanked?: boolean;
    bpm?: number;
    duration: number;
    likes: number;
    createdAt: number | CalendarDateTime;
    selected?: boolean;
    selected$?: Observable<boolean>;
    downloading?: boolean;
    showOwned?: boolean;
    isOwned$?: Observable<boolean>;
    canOpenMapDetails?: boolean;
    canOpenAuthorDetails?: boolean;
    callBackParam: T;
    onDelete?: (param: T) => void;
    onDownload?: (param: T) => void;
    onSelected?: (param: T) => void;
    onCancelDownload?: (param: T) => void;
    onDoubleClick?: (param: T) => void;
    onHighlightedDiffsChange?: (diffs: BPListDifficulty[]) => void;
};

export function MapItemComponent <T = unknown>({ hash, title, autor, songAutor, coverUrl, songUrl, autorId, mapId, diffs, highlightedDiffs, ranked, blRanked, bpm, duration, likes, createdAt, selected, selected$, downloading, showOwned, isOwned$, canOpenMapDetails, canOpenAuthorDetails, callBackParam, onDelete, onDownload, onSelected, onCancelDownload, onDoubleClick, onHighlightedDiffsChange }: MapItemComponentProps<T>) {
    const linkOpener = useService(LinkOpenerService);
    const audioPlayer = useService(AudioPlayerService);

    const color = useThemeColor("first-color");
    const t = useTranslation();

    const ref = useRef(null);
    const isSelected = useObservable(() => selected$ ?? of(selected), false, [selected$, selected]);
    const isOwned = useObservable(() => isOwned$ ?? of(showOwned ?? false), false, [isOwned$, showOwned]);
    const [hovered, setHovered] = useState(false);
    const [bottomBarHovered, setBottomBarHovered, cancelBottomBarHovered] = useDelayedState(false);
    const [diffsPanelHovered, setDiffsPanelHovered] = useState(false);
    const [_highlightedDiffs, setDiffsSelected] = useState<BPListDifficulty[]>(highlightedDiffs ?? []);

    useDoubleClick({
        ref,
        latency: onDoubleClick ? 200 : 0,
        onSingleClick: () => onSelected?.(callBackParam),
        onDoubleClick: () => onDoubleClick?.(callBackParam),
    });

    useOnUpdate(() => {
        if(!_highlightedDiffs?.length){ return; }
        onHighlightedDiffsChange?.(_highlightedDiffs);
    }, [_highlightedDiffs])

    const songPlaying = useObservable(() => audioPlayer.playing$.pipe(map(playing => playing && audioPlayer.src === songUrl)));

    const MAP_DIFFICULTIES = useConstant(() => Object.values(SongDiffName))
    const previewUrl = mapId ? `https://allpoland.github.io/ArcViewer/?id=${mapId}` : null;
    const mapUrl = mapId ? `https://beatsaver.com/maps/${mapId}` : null;
    const authorUrl = autorId ? `https://beatsaver.com/profile/${autorId}` : null;
    const likesText = likes ? Intl.NumberFormat(undefined, { notation: "compact" }).format(likes).split(" ").join("") : null;
    const mapCoverUrl = coverUrl || `https://eu.cdn.beatsaver.com/${hash}.jpg`;

    const createdDate = useConstant(() => {
        if(!createdAt){ return null; }
        const date = typeof createdAt === "number" ? new Date(createdAt * 1000) : createdAt.toDate(getLocalTimeZone());
        return dateFormat(date, "d mmm yyyy");
    });

    const durationText = (() => {
        if (!duration) {
            return null;
        }
        const date = new Date(0);
        date.setSeconds(duration);
        return duration > 3600 ? dateFormat(date, "h:MM:ss") : dateFormat(date, "MM:ss");
    })();

    const parseDiffLabel = (diffLabel: string) => {
        if (MAP_DIFFICULTIES.includes(diffLabel as SongDiffName)) {
            return t(`maps.difficulties.${diffLabel}`);
        }
        return diffLabel;
    };

    const openPreview = () => {
        if (audioPlayer.playing) {
            audioPlayer.pause();
        }
        linkOpener.open(previewUrl, true);
    };
    const copyBsr = () => navigator.clipboard.writeText(`!bsr ${mapId}`);
    const toogleMusic = () => {
        if (songPlaying) {
            return audioPlayer.pause();
        }
        if (!audioPlayer.playing && audioPlayer.src === songUrl) {
            return audioPlayer.resume();
        }
        audioPlayer.play([{ src: songUrl, bpm: bpm ?? 1 }]);
    };

    const bottomBarHoverStart = () => {
        cancelBottomBarHovered();
        setBottomBarHovered(true, diffsPanelHovered || bottomBarHovered ? 0 : 300);
    };

    const bottomBarHoverEnd = () => {
        cancelBottomBarHovered();
        setBottomBarHovered(false, 100);
    };

    const isDiffHightlighted = (diff: {name: string, characteristic: string}) => {
        if(!_highlightedDiffs?.length){ return false; }
        return _highlightedDiffs.some(d => d?.name?.toLowerCase() === diff?.name?.toLowerCase() && d?.characteristic?.toLowerCase() === diff?.characteristic?.toLowerCase());
    }

    const diffsPanelHoverStart = () => setDiffsPanelHovered(true);
    const diffsPanelHoverEnd = () => setDiffsPanelHovered(false);

    const renderDiffPreview = () => {
        const diffSets = Array.from(diffs.entries());

        if (diffSets.length === 1) {
            const [, diffSet] = diffSets[0];

            return (
                <>
                    <BsmIcon className="h-4 w-4 mr-px" icon="bsMapDifficulty" />
                    <div className="flex py-[2px] gap-[1px] h-full">
                        {diffSet.map((diff) => (
                            <span key={`${diff.libelle}${diff.name}${diff.stars}`} className="h-full w-[6px] rounded-full" style={{ backgroundColor: MAP_DIFFICULTIES_COLORS[diff.name] }} />
                        ))}
                    </div>
                </>
            );
        }
        if (diffSets.length > 1) {
            return diffSets.map(([diffType, diffSet]) => (
                <Fragment key={diffType}>
                    <BsmIcon className="h-full w-fit mr-px" icon={diffType} />
                    <span className="mr-2 font-bold text-[15px] h-full flex items-center pb-px">{diffSet.length}</span>
                </Fragment>
            ));
        }

        return null;
    };

    const handleDiffCheckChange = (diff: BPListDifficulty) => {
        if(!_highlightedDiffs?.length){
            setDiffsSelected([diff]);
        }

        const index = _highlightedDiffs?.findIndex(d => d?.name?.toLowerCase() === diff?.name?.toLowerCase() && d?.characteristic?.toLowerCase() === diff?.characteristic?.toLowerCase());
        if(index === -1){
            setDiffsSelected([..._highlightedDiffs, diff]);
        } else {
            setDiffsSelected(_highlightedDiffs.filter((_, i) => i !== index));
        }
    }

    return (
        <motion.li className="relative h-[100px] min-w-[370px] shrink-0 grow basis-0 text-white group cursor-pointer" onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} style={{ zIndex: hovered && 5, transform: "translateZ(0) scale(1.0, 1.0)", backfaceVisibility: "hidden" }}>
            <GlowEffect visible={hovered || (isSelected && !!onSelected)} />
                <AnimatePresence>
                    {(diffsPanelHovered || bottomBarHovered) && (
                        <motion.ul key={hash} className="absolute top-[calc(100%-10px)] w-full h-fit max-h-[200%] pt-4 pb-2 px-2 overflow-y-scroll bg-light-main-color-3 dark:bg-main-color-3 text-main-color-1 dark:text-current brightness-125 rounded-md flex flex-col gap-3 scrollbar-default shadow-sm shadow-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onHoverStart={diffsPanelHoverStart} onHoverEnd={diffsPanelHoverEnd}>
                            {Array.from(diffs.entries()).map(([charac, diffSet]) => (
                                <ol key={charac} className="flex flex-col w-full gap-1">
                                    {diffSet.map(({ name, libelle, stars }) => (
                                        <li key={`${name}${libelle}${stars}`} className="w-full h-4 flex items-center gap-1">
                                            {onHighlightedDiffsChange && (
                                                <Tippy content={t("maps.map-item.hightlight-difficulty")} placement="top" theme="default">
                                                    <div className="h-full aspect-square">
                                                        <BsmCheckbox className="size-full relative" checked={isDiffHightlighted({name, characteristic: charac})} onChange={() => handleDiffCheckChange({name, characteristic: charac})} />
                                                    </div>
                                                </Tippy>
                                            )}
                                            <BsmIcon className="h-full w-fit p-px shrink-0" icon={charac} />
                                            <span className="h-full px-2 flex items-center text-xs font-bold bg-current rounded-full" style={{ color: MAP_DIFFICULTIES_COLORS[name] }}>
                                                {stars ? <span className="h-full block brightness-[.25]">★ {stars.toFixed(2)}</span> : <span className="h-full brightness-[.25] leading-4 pb-[2px] capitalize">{parseDiffLabel(name)}</span>}
                                            </span>
                                            <span className={cn("text-sm leading-4 pb-[2px] line-clamp-1", isDiffHightlighted({name, characteristic: charac}) && "text-yellow-400")}>{parseDiffLabel(libelle)}</span>
                                        </li>
                                    ))}
                                </ol>
                            ))}
                        </motion.ul>
                    )}
                </AnimatePresence>
            <div className="h-full w-full relative pl-[100px] rounded-md overflow-hidden flex flex-row justify-end">
                <div className={`absolute top-0 left-0 h-full aspect-square cursor-pointer ${isOwned && "border-l-[5px]"}`} style={{ borderColor: isOwned && color }}>
                    <BsmImage className="size-full object-cover" image={mapCoverUrl} placeholder={defaultImage} errorImage={defaultImage} />
                    <span
                        className="absolute flex justify-center items-center size-full pr-1 bg-transparent top-0 left-0 group-hover:bg-black group-hover:bg-opacity-40"
                        style={{ color }}
                        onClick={e => {
                            e.stopPropagation();
                            e.preventDefault();
                            toogleMusic();
                        }}
                    >
                        <BsmIcon className="size-full p-7 opacity-0 group-hover:opacity-100 text-white hover:text-current" icon={songPlaying ? "pause" : "play"} />
                    </span>
                </div>
                <div className="relative h-full w-full z-[1] rounded-md overflow-hidden -translate-x-1" ref={ref}>
                    <BsmImage className="absolute top-0 left-0 size-full -z-[1] object-cover saturate-200" image={mapCoverUrl} placeholder={defaultImage} errorImage={defaultImage} />
                    <div className="pt-1 pl-2 pr-7 top-0 left-0 size-full bg-neutral-600 bg-opacity-80 flex flex-col justify-between group-hover:bg-main-color-1 group-hover:bg-opacity-80">
                        <h1 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full leading-5 tracking-wide text-lg" title={title}>
                            {canOpenMapDetails !== false ? (
                                <BsmLink className="hover:underline" href={mapUrl}>
                                    {title}
                                </BsmLink> ) : (
                                title
                            )}
                        </h1>
                        <h2 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-sm mb-[3px]">{songAutor && t("maps.map-item.by", { songAutor })}</h2>
                        <h3 className="font-bold whitespace-nowrap text-ellipsis overflow-hidden w-full text-xs">
                            {autor && (
                                <>
                                    {` ${t("maps.map-item.mapped-by")} `}
                                    {canOpenAuthorDetails !== false ? (
                                        <BsmLink href={authorUrl} className="brightness-200 hover:underline" style={{ color }}>
                                            {autor}
                                        </BsmLink>
                                    ) : (
                                        <span className="brightness-200" style={{ color }}>{autor}</span>
                                    )}
                                </>
                            )}
                        </h3>
                        <div className="w-full h-4 text-xs gap-2 flex opacity-0 group-hover:opacity-100">
                            {likesText && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-full py-[2px] w-fit shrink-0 mr-1" icon="thumbUpFill" />
                                    <span className="mb-[2px]">{likesText}</span>
                                </div>
                            )}
                            {durationText && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-full py-[2px] w-fit shrink-0 mr-1" icon="timerFill" />
                                    <span className="mb-[2px]">{durationText}</span>
                                </div>
                            )}
                            {createdAt && (
                                <div className="h-full flex items-center">
                                    <BsmIcon className="h-full py-[2px] w-fit shrink-0 mr-1" icon="checkCircleIcon" />
                                    <time className="mb-[2px]">{createdDate}</time>
                                </div>
                            )}
                        </div>
                        <motion.div className="w-full h-5 pb-1 pr-7 flex items-center gap-1" onHoverStart={bottomBarHoverStart} onHoverEnd={bottomBarHoverEnd}>
                            {ranked && (
                                <div className="text-yellow-300 bg-current rounded-full px-1 h-full flex items-center justify-center">
                                    <span className="uppercase text-xs font-bold tracking-wide brightness-[.25]">{t("maps.map-specificities.ranked")}</span>
                                </div>
                            )}
                            {blRanked && (
                                <div className="bg-pink-400 bg-current rounded-full px-1 h-full flex items-center justify-center">
                                    <span className="uppercase text-xs font-bold tracking-wide brightness-[.25]">{t("maps.map-specificities.ranked")}</span>
                                </div>
                            )}
                            <div className="h-full grow flex items-start content-start">{renderDiffPreview()}</div>
                        </motion.div>
                    </div>
                </div>
                <div className="absolute bg-light-main-color-3 dark:bg-main-color-3 top-0 h-full z-[1] w-[30px] -right-5 group-hover:-translate-x-5 transition-transform">
                    <span className="absolute w-[10px] h-[10px] top-0 right-full bg-inherit" style={{ clipPath: 'path("M11 -1 L11 10 L10 10 A10 10 0 0 0 0 0 L0 -1 Z")' }} />
                    <span className="absolute w-[10px] h-[10px] bottom-0 right-full bg-inherit" style={{ clipPath: 'path("M11 11 L11 0 L10 0 A10 10 0 0 1 0 10 L 0 11 Z")' }} />

                    <div className="flex flex-col justify-center items-center gap-1 size-full overflow-hidden opacity-0 group-hover:opacity-100">
                        {onDelete && !downloading && (
                        <Tippy content={t("maps.map-item.delete")} placement="left" theme="default">
                                <BsmButton
                                    className="w-6 h-6 p-0.5 rounded-md !bg-inherit hover:!bg-light-main-color-2 hover:dark:!bg-main-color-2 text-red-500"
                                    iconClassName="size-full"
                                    icon="trash"
                                    withBar={false}
                                    onClick={e => {
                                        e.stopPropagation();
                                        onDelete(callBackParam);
                                    }}
                                />
                        </Tippy>
                        )}
                        {onDownload && !downloading && (
                        <Tippy content={t("maps.map-item.download")} placement="left" theme="default">
                                <BsmButton
                                    className="w-6 h-6 p-0.5 rounded-md !bg-inherit hover:!bg-light-main-color-2 hover:dark:!bg-main-color-2"
                                    iconClassName="size-full brightness-75 dark:brightness-200"
                                    iconColor={color}
                                    icon="download"
                                    withBar={false}
                                    onClick={e => {
                                        e.stopPropagation();
                                        onDownload(callBackParam);
                                    }}
                                />
                        </Tippy>
                        )}
                        {onCancelDownload && !downloading && (
                        <Tippy content={t("maps.map-item.cancel-download")} placement="left" theme="default">
                                <BsmButton
                                    className="w-6 h-6 p-1 rounded-md !bg-inherit hover:!bg-light-main-color-2 hover:dark:!bg-main-color-2"
                                    iconClassName="size-full brightness-75 dark:brightness-200"
                                    iconColor="red"
                                    icon="cross"
                                    withBar={false}
                                    onClick={e => {
                                        e.stopPropagation();
                                        onCancelDownload(callBackParam);
                                    }}
                                />
                        </Tippy>
                        )}
                        {downloading &&
                        <Tippy content={t("maps.map-item.downloading")} placement="left" theme="default">
                        <div>
                            <BsmBasicSpinner className="w-6 h-6 p-1 rounded-md !bg-inherit hover:!bg-light-main-color-2 hover:dark:!bg-main-color-2 flex items-center justify-center" spinnerClassName="brightness-75 dark:brightness-200" style={{ color }} thikness="3px" />
                        </div>
                        </Tippy>
                        }
                        {previewUrl && (
                        <Tippy content={t("maps.map-item.preview")} placement="left" theme="default">
                            <BsmButton
                                className="w-6 h-6 p-0.5 rounded-md !bg-inherit hover:!bg-light-main-color-2 hover:dark:!bg-main-color-2"
                                iconClassName="size-full brightness-75 dark:brightness-200"
                                iconColor={color}
                                icon="eye"
                                withBar={false}
                                onClick={e => {
                                    e.stopPropagation();
                                    openPreview();
                                }}
                            />
                        </Tippy>
                        )}
                        {mapId && (
                        <Tippy content={t("maps.map-item.bsr-code")} placement="left" theme="default">
                            <BsmButton
                                className="w-6 h-6 p-1 rounded-md !bg-inherit hover:!bg-light-main-color-2 hover:dark:!bg-main-color-2"
                                iconClassName="size-full brightness-75 dark:brightness-200"
                                iconColor={color}
                                icon="twitch"
                                withBar={false}
                                onClick={e => {
                                    e.stopPropagation();
                                    copyBsr();
                                }}
                            />
                        </Tippy>
                        )}
                    </div>
                </div>
            </div>
        </motion.li>
    );
};

export const MapItem = typedMemo(MapItemComponent, equal);
