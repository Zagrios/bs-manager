import { logRenderError } from "renderer";
import { Pagination } from "@nextui-org/react";
import { ReactNode, useEffect, useState } from "react";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent } from "renderer/services/modale.service";
import { defaultBeatleaderAPIClientService } from "renderer/services/third-parties";
import { SongDetailDiffCharactertistic, SongDiffName } from "shared/models/maps";
import { LeaderboardColumn, LeaderboardScore } from "shared/models/leaderboard.types";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import BeatConflictImg from "../../../../../assets/images/apngs/beat-conflict.png";
import BeatWaitingImg from "../../../../../assets/images/apngs/beat-waiting.png";
import { BsmButton } from "renderer/components/shared/bsm-button.component";

const ITEMS_PER_PAGE = 15;

export enum LeaderboardType {
    ScoreSaber = "score-saber",
    Beatleader = "beatleader",
    None = "none", // Default
}

type RefreshPage = (params: {
    newCharacteristic?: SongDetailDiffCharactertistic;
    newDifficulty?: SongDiffName;
    newHighscore?: boolean;
    newPage?: number;
}) => Promise<void>;

function useHeader({
    title,
    icon,
}: Readonly<{
    title: string;
    icon: string;
}>) {
    return {
        renderHeader() {
            return <div className="flex justify-center items-center gap-2 mb-2">
                <BsmImage
                    className="w-16 h-16 aspect-square"
                    image={icon}
                />
                <h1 className="tracking-wide uppercase text-3xl text-center">
                    {title}
                </h1>
            </div>
        }
    }
}

function useDifficulty({
    map,
    characteristic, setCharacteristic,
    difficulty, setDifficulty,
    refreshPage,
}: Readonly<{
    map: BsmLocalMap;
    characteristic: SongDetailDiffCharactertistic;
    setCharacteristic: (c: SongDetailDiffCharactertistic) => void;
    difficulty: SongDiffName;
    setDifficulty: (d: SongDiffName) => void;
    refreshPage: RefreshPage;
}>) {
    const modes = map.songDetails.difficulties
        .reduce((modes, difficulty) => {
            let difficulties = modes[difficulty.characteristic];
            if (!difficulties) {
                difficulties = [];
                modes[difficulty.characteristic] = difficulties;
            }
            difficulties.push(difficulty.difficulty);
            return modes;
        }, {} as Record<SongDetailDiffCharactertistic, SongDiffName[]>);

    const changeCharacteristic = (char: SongDetailDiffCharactertistic) => {
        if (characteristic === char) {
            return;
        }

        const diff = modes[char][0];
        setCharacteristic(char);
        setDifficulty(diff);
        refreshPage({
            newCharacteristic: char,
            newHighscore: true,
            newDifficulty: diff,
            newPage: 1,
        });
    }

    const changeDifficulty = (diff: SongDiffName) => {
        if (difficulty === diff) {
            return;
        }

        setDifficulty(diff);
        refreshPage({
            newDifficulty: diff,
            newHighscore: true,
            newPage: 1,
        });
    }

    return {
        renderDifficultySelector() {
            const characteristics = Object.keys(modes) as SongDetailDiffCharactertistic[];
            return <>
                <div className="flex justify-evenly">
                    {characteristics.map(char =>
                        <BsmButton
                            key={char}
                            icon={char}
                            iconClassName="h-8 w-8 p-px shrink-0"
                            typeColor={char === characteristic ? "primary" : "none"}
                            withBar={false}
                            onClick={event => {
                                event.stopPropagation();
                                changeCharacteristic(char);
                            }}
                        />
                    )}
                </div>

                <div className="flex justify-evenly">
                    {modes[characteristic].map(diff =>
                        <BsmButton
                            key={diff}
                            text={diff}
                            typeColor={diff === difficulty ? "primary" : "none"}
                            withBar={false}
                            onClick={event => {
                                event.stopPropagation();
                                changeDifficulty(diff);
                            }}
                        />
                    )}
                </div>
            </>
        },
    }
}

function useLeaderboard({
    map,
    columns,
    characteristic,
    difficulty,
    getMapScores,
    getMapPlayerHighscore,
}: {
    map: BsmLocalMap;
    columns: LeaderboardColumn[];
    characteristic: SongDetailDiffCharactertistic;
    difficulty: SongDiffName;
    getMapScores: (
        hash: string,
        characteristic: SongDetailDiffCharactertistic,
        difficulty: SongDiffName,
        page?: number,
        items?: number
    ) => Promise<{
        scores: LeaderboardScore[];
        total: number;
    }>;
    getMapPlayerHighscore: (
        hash: string,
        characteristic: SongDetailDiffCharactertistic,
        difficulty: SongDiffName
    ) => Promise<LeaderboardScore>;
}) {
    const colors = useThemeColor();

    const [scores, setScores] = useState([] as LeaderboardScore[]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [highscore, setHighscore] = useState(null as LeaderboardScore | null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null as Error | null);

    useEffect(() => {
        refreshPage({ newHighscore: true, });
    }, []);

    const toPage = (newPage: number) => {
        if (page === newPage) {
            return;
        }

        refreshPage({ newPage });
    };

    const refreshPage: RefreshPage = async ({
        newCharacteristic,
        newDifficulty,
        newHighscore,
        newPage,
    }) => {
        newPage = newPage || page;
        newCharacteristic = newCharacteristic || characteristic;
        newDifficulty = newDifficulty || difficulty;

        if (newHighscore) {
            setLastPage(1);
        }

        setPage(newPage);
        setLoading(true);

        try {
            const { scores: newScores, total } = await getMapScores(
                map.hash, newCharacteristic, newDifficulty,
                newPage, ITEMS_PER_PAGE
            );

            setLastPage(Math.ceil(total / ITEMS_PER_PAGE));
            setScores(newScores);

            if (newHighscore) {
                const score = await getMapPlayerHighscore(
                    map.hash, newCharacteristic, newDifficulty
                );
                setHighscore(score);
            }
        } catch (error: any) {
            logRenderError("could not query map scores", error);
            setError(error);
        } finally {
            setLoading(false);
        }
    }

    const renderRow = ({
        score, className, style, onClick
    }: Readonly<{
        score: LeaderboardScore;
        className?: string;
        style?: Record<string, string>;
        onClick?: () => void;
    }>) => {
        const getText = (column: LeaderboardColumn) => {
            const text = score[column.key];
            if (!text) {
                return column.default;
            }
            if (column.formatter) {
                return column.formatter(text);
            }
            return text;
        }

        return <tr
            className={className}
            style={style}
            onClick={onClick}
        >
            {columns.map(column =>
                <td
                    key={column.key}
                    className={`font-${column.font || "normal"}`}
                    style={{
                        textAlign: column.textAlignment || "left",
                    }}
                >
                    {getText(column)}
                </td>
            )}
        </tr>
    }

    const renderRows = () => {
        return <>
            {scores.map(score =>
                renderRow({
                    score,
                    className: score.id === highscore?.id ? "text-gray-800 dark:text-gray-200 rounded-full" : "",
                    style: score.id === highscore?.id ? {
                        backgroundImage: `linear-gradient(to right, ${colors.firstColor}, ${colors.secondColor})`
                    } : {}
                })
            )}

            {highscore &&
                renderRow({
                    score: highscore,
                    className: "text-gray-800 dark:text-gray-200 rounded-full cursor-pointer",
                    style: {
                        backgroundImage: `linear-gradient(to right, ${colors.firstColor}, ${colors.secondColor})`
                    },
                    onClick: () => {
                        toPage(Math.ceil(highscore.rank / ITEMS_PER_PAGE));
                    }
                })
            }
        </>
    }

    function renderTable() {
        return <>
            <table className="w-full">
                <tr className="bg-gradient-to-br from-light-main-color-3 to-light-main-color-2 dark:from-main-color-3 dark:to-main-color-2">
                    {columns.map(column =>
                        <th
                            key={column.key}
                            style={{
                                textAlign: column.headerAlignment || "center",
                            }}
                        >
                            {column.header}
                        </th>
                    )}
                </tr>

                {loading &&
                    <tr>
                        <td colSpan={columns.length}>
                            <LeaderboardStatus
                                text="Getting player scores..."
                                image={BeatWaitingImg}
                                spin
                            />
                        </td>
                    </tr>}

                {!loading && error &&
                    <tr>
                        <td colSpan={columns.length}>
                            <LeaderboardStatus
                                text="Something went wrong"
                                image={BeatConflictImg}
                            >
                                Reason: {error.message}
                            </LeaderboardStatus>
                        </td>
                    </tr>}

                {!loading && !error && renderRows()}
            </table>

            <Pagination
                className="mt-2"
                page={page}
                total={lastPage}
                isCompact
                onChange={toPage}
            />
        </>
    }

    return {
        page,
        refreshPage,
        renderTable
    };
}

function LeaderboardStatus({ text, image, spin = false, children }: Readonly<{
    text: string;
    image: string;
    spin?: boolean,
    children?: ReactNode
}>) {
    const t = useTranslation();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 dark:text-gray-200">
            <img className={`w-32 h-32 ${spin ? "spin-loading" : ""}`} src={image} alt=" " />
            <span className="text-xl mt-3 italic">{t(text)}</span>
            {children}
        </div>
    );
}

export const LeaderboardModal: ModalComponent<{}, {
    leaderboard: LeaderboardType;
    map: BsmLocalMap;
    difficulty?: {
        characteristic: SongDetailDiffCharactertistic;
        name: SongDiffName;
    };
}> = ({ options: { data: { map, difficulty: initialDifficulty } } }) => {
    // NOTE: Add ScoreSaber here in the future
    const beatleaderAPI = defaultBeatleaderAPIClientService();
    const columns = beatleaderAPI.getColumns()
        .filter(column => !column.condition || column.condition(map))

    const [characteristic, setCharacteristic] = useState(
        initialDifficulty?.characteristic || map.songDetails.difficulties[0].characteristic
    );
    const [difficulty, setDifficulty] = useState(
        initialDifficulty?.name || map.songDetails.difficulties[0].difficulty
    );

    const { renderHeader } = useHeader({
        title: beatleaderAPI.getTitle(),
        icon: beatleaderAPI.getIcon(),
    });
    const { refreshPage, renderTable, } = useLeaderboard({
        map, columns,
        characteristic, difficulty,
        getMapScores: beatleaderAPI.getMapScores,
        getMapPlayerHighscore: beatleaderAPI.getMapPlayerHighscore,
    });

    const { renderDifficultySelector, } = useDifficulty({
        map,
        characteristic, setCharacteristic,
        difficulty, setDifficulty,
        refreshPage,
    });

    return <div style={{ width: "600px" }}>
        {renderHeader()}
        {renderDifficultySelector()}
        {renderTable()}
    </div>
}

