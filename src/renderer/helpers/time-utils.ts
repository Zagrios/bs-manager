const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;

export function minToS(minutes: number): number {
    return minutes * SECONDS_IN_MINUTE;
}

export function hourToMin(hours: number): number {
    return hours * MINUTES_IN_HOUR;
}

export function hourToS(hours: number): number {
    return hours * minToS(MINUTES_IN_HOUR);
}
