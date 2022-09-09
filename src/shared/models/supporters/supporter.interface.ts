import { SupporterType } from "./supporter.type";

export interface Supporter {
    username: string,
    type?: SupporterType,
    link?: string,
    image?: string,
}