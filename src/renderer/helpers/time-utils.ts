const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;

export function min_to_s(minutes: number): number{
    return minutes * SECONDS_IN_MINUTE;
}

export function hour_to_min(hours: number): number{
    return hours * MINUTES_IN_HOUR;
}

export function hour_to_s(hours: number): number{
    return hours * min_to_s(MINUTES_IN_HOUR);
}