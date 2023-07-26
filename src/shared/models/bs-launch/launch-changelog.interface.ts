export interface Changelog {
    [key:string]: ChangelogVersion[];
}

export interface ChangelogVersion {
    title : string;
    body: string;
}
