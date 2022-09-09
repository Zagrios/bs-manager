import { SupporterType } from "./supporter.type";
import { SupporterInterface } from "./supporter.interface";

export class SupporterModel{
    constructor(private args: SupporterInterface){}

    public get username(): string{ return this.args.username; }
    public get type(): SupporterType{ return this.args.type; }

    public get link(): string{
        if(this.type === "basic"){ return null; }
        return this.args.link;
    }

    public get image(): string{
        if(this.type !== "sponsor"){ return null; }
        return this.args.image;
    }
}