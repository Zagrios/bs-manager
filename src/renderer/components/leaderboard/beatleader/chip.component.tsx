
type Props = {
    name: string;
    value: number | string;
}

export function BeatleaderChip({ name, value }: Readonly<Props>) {
    return <span className="rounded-md px-2 bg-light-main-color-3 dark:bg-main-color-3 capitalize">
        {name} | {value}
    </span>
}

