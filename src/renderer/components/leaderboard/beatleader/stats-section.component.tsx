import Tippy from "@tippyjs/react";
import { BeatleaderPlayerInfo, BeatleaderScoreStats } from "renderer/services/third-parties/beatleader.service"
import { BeatleaderChip } from "./chip.component";
import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";

type Props = {
    playerInfo: BeatleaderPlayerInfo;
}

export function BeatleaderStatsSection({
    playerInfo
}: Readonly<Props>) {
    const [showHidden, setShowHidden] = useState(false);

    const intFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    const numberFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatPp = (pp: number) => `${numberFormatter.format(pp)}pp`;
    const formatAccuracy = (accuracy: number) => `${(Math.round(accuracy * 1000) / 100).toFixed(2)}%`;
    const formatPercentile = (percentile: number) => `Top ${(Math.round(percentile * 1000) / 100).toFixed(2)}% of players`;
    const formatRank = (rank: number) => `#${numberFormatter.format(rank)}`;

    const topChips: ChipInfo[] = [{
        resource: "total play count",
        key: "totalPlayCount",
        formatter: intFormatter.format,
    }, {
        resource: "total score",
        key: "totalScore",
        formatter: intFormatter.format,
        hidden: true,
    }, {
        resource: "ranked play count",
        key: "rankedPlayCount",
        formatter: intFormatter.format,
    }, {
        resource: "total ranked score",
        key: "totalRankedScore",
        formatter: intFormatter.format,
        hidden: true,
    }, {
        resource: "top PP",
        key: "topPp",
        formatter: formatPp,
    }, {
        resource: "best acc",
        key: "topAccuracy",
        formatter: formatAccuracy,
        hidden: true,
    }, {
        resource: "best ranked acc",
        key: "topRankedAccuracy",
        formatter: formatAccuracy,
        hidden: true,
    }, {
        resource: "average acc",
        key: "averageAccuracy",
        formatter: formatAccuracy,
        hidden: true,
    }, {
        resource: "median acc",
        key: "medianAccuracy",
        formatter: formatAccuracy,
        hidden: true,
    }, {
        resource: "average ranked acc",
        key: "averageRankedAccuracy",
        formatter: formatRank,
    }, {
        resource: "weighted ranked acc",
        key: "averageWeightedRankedAccuracy",
        formatter: formatAccuracy,
        hidden: true,
    }, {
        resource: "median ranked acc",
        key: "medianRankedAccuracy",
        formatter: formatAccuracy,
        hidden: true,
    }, {
        resource: "weighted average rank",
        key: "averageWeightedRankedRank",
        formatter: formatRank,
        hidden: true,
    }, {
        resource: "peak rank",
        key: "peakRank",
        formatter: intFormatter.format,
        hidden: true,
    }, {
        resource: "average rank",
        key: "averageRank",
        formatter: formatRank,
    }, {
        resource: "global",
        key: "topPercentile",
        formatter: formatPercentile,
        hidden: true,
    }, {
        resource: "country",
        key: "countryTopPercentile",
        formatter: formatPercentile,
        hidden: true,
    }];

    const bottomChips: ChipInfo[] = [{
        resource: "SS+",
        key: "sspPlays",
        formatter: intFormatter.format,
    }, {
        resource: "SS",
        key: "ssPlays",
        formatter: intFormatter.format,
    }, {
        resource: "S+",
        key: "spPlays",
        formatter: intFormatter.format,
    }, {
        resource: "S",
        key: "sPlays",
        formatter: intFormatter.format,
    }];

    return <div className="w-full h-fit flex gap-x-4 rounded-md p-4 bg-light-main-color-2 dark:bg-main-color-2">
        <div className="h-fit">
            <div className="w-fit px-1 rounded-t-md bg-light-main-color-3 dark:bg-main-color-3 text-purple-700 dark:text-purple-300 text-xl font-bold">
                {formatPp(playerInfo.pp)}
            </div>
            <div className="rounded-md rounded-tl-none p-1 bg-light-main-color-1 dark:bg-main-color-1">
                <BeatleaderRowInfo name="Global" hoverText="Global Ranking">
                    <div>#{playerInfo.rank}</div>
                </BeatleaderRowInfo>
                <BeatleaderRowInfo name="Country" hoverText="Country Ranking">
                    <div>{playerInfo.country} #{playerInfo.countryRank}</div>
                </BeatleaderRowInfo>
                <BeatleaderRowInfo name="Platform" hoverText="Last 50 scores top platform">
                    <div className="capitalize">{playerInfo.scoreStats.topPlatform}</div>
                </BeatleaderRowInfo>
            </div>
        </div>
        <div className="flex-1 flex flex-row justify-between rounded-md p-2 bg-light-main-color-1 dark:bg-main-color-1">
            <div className="flex flex-col justify-between gap-2">
                <div className="flex flex-row flex-wrap gap-2">
                    {topChips.filter(chip => showHidden || !chip.hidden).map(chip =>
                        <BeatleaderChip
                            key={chip.key}
                            name={chip.resource}
                            value={chip.formatter(playerInfo.scoreStats[chip.key])}
                        />
                    )}
                </div>
                <div className="flex flex-row flex-wrap gap-2">
                    {bottomChips.map(chip =>
                        <BeatleaderChip
                            key={chip.key}
                            name={chip.resource}
                            value={chip.formatter(playerInfo.scoreStats[chip.key])}
                        />
                    )}
                </div>
            </div>
            <div>
                <BsmButton
                    className="w-8 h-8 aspect-square"
                    icon={showHidden ? "eye-cross" : "eye"}
                    onClick={() => setShowHidden(!showHidden)}
                />
            </div>
        </div>

    </div>
}

function BeatleaderRowInfo({ name, hoverText, children }: Readonly<{
    name: string;
    hoverText: string;
    children: JSX.Element;
}>) {
    return <div className="flex justify-between gap-x-4">
        <Tippy content={hoverText}>
            <div className="capitalize font-semibold">{name}</div>
        </Tippy>
        {children}
    </div>
}

type ChipInfo = {
    resource: string;
    key: keyof BeatleaderScoreStats;
    formatter: (value: any) => string;
    hidden?: boolean;
};

