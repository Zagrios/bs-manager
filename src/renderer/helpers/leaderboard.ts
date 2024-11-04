const INT_FORMATTER = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const formatInt = INT_FORMATTER.format;
export const formatPp = (pp: number) => `${NUMBER_FORMATTER.format(pp)}pp`;
export const formatAccuracy = (accuracy: number) => `${(Math.round(accuracy * 10000) / 100).toFixed(2)}%`;
export const formatPercentile = (percentile: number) => `Top ${(Math.round(percentile * 10000) / 100).toFixed(2)}% of players`;
export const formatRank = (rank: number) => `#${NUMBER_FORMATTER.format(rank)}`;
