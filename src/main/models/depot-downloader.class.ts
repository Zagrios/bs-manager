import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio, spawn } from "child_process";
import { Observable, ReplaySubject, Subscriber, filter, map, share } from "rxjs";
import { DepotDownloaderArgsOptions, DepotDownloaderErrorEvent, DepotDownloaderEvent, DepotDownloaderEventType, DepotDownloaderEventTypes, DepotDownloaderInfoEvent, DepotDownloaderWarningEvent } from "../../shared/models/depot-downloader.model";
import { DownloadEvent } from "main/services/bs-installer.service";

export class DepotDownloader {

    private process: ChildProcessWithoutNullStreams;
    private processOut$: Observable<string>;
    private subscriber: Subscriber<string>;

    public constructor(options: {
        command: string, args?: string[], options?: SpawnOptionsWithoutStdio, echoStartData?: unknown
    }){

        this.processOut$ = new Observable<string>(subscriber => {

            this.subscriber = subscriber;

            console.log(`${options.command} ${options.args?.join(" ")}}`)

            this.process = spawn(options.command, options.args ?? [], options.options);

            subscriber.next(`[Info]|[Start]|${JSON.stringify(options.echoStartData) ?? ""}`);
            
            this.process.stdout.on("data", data => {
                const lines: string[] = data.toString().split("\n");
                lines.forEach(line => subscriber.next(line));
            });
            
            this.process.stderr.on("error", error => subscriber.error(error));
            this.process.on("exit", code => subscriber.complete());

            return () => {
                console.log("DepotDownloader process killed")
                this.process.kill();
                this.process = null;
            }

        }).pipe(share({connector: () => new ReplaySubject(1)}));
    }

    public $events(): Observable<DepotDownloaderEvent<unknown>>{

        const eventTypesArr = Object.values(DepotDownloaderEventType);

        const DepotDownloaderSubTypeOfEventType: {[key in DepotDownloaderEventType]: DepotDownloaderEventTypes[]} = {
            [DepotDownloaderEventType.Error]: Object.values(DepotDownloaderErrorEvent),
            [DepotDownloaderEventType.Warning]: Object.values(DepotDownloaderWarningEvent),
            [DepotDownloaderEventType.Info]: Object.values(DepotDownloaderInfoEvent),
        }

        return this.processOut$.pipe(map(line => {

            console.log(line);

            const matched = (line.toString() as string).match(/(?:\[(.*?)\])\|(?:\[(.*?)\]\|)?(.*?)(?=$|\[)/gm)?.[0] ?? null;

            if(!matched){ return null; }

            const splitedLine = matched.split("|").map(str => str.trim().replaceAll("[", "").replaceAll("]", "")) as [DepotDownloaderEventType, DepotDownloaderEventTypes, unknown];

            if(!eventTypesArr.includes(splitedLine[0] as DepotDownloaderEventType) || !DepotDownloaderSubTypeOfEventType[splitedLine[0]].includes(splitedLine[1])){
                return null;
            }

            return {
                type: splitedLine[0] as DepotDownloaderEventType,
                subType: splitedLine[1] as DepotDownloaderEventTypes,
                data: splitedLine[2] as unknown,
            }

        }), 
        filter(Boolean));
    }

    public sendInput(input: string): boolean{
        if(!this.process.stdin.writable){ throw new Error("DepotDownloader stdin is not writable"); }
        return this.process.stdin.write(`${input}\n`);
    }

    public stop(){
        this.subscriber.complete();
    }

    public get running(){ return !!this.process }

    public static buildArgs(depotDownloaderArgs: DepotDownloaderArgsOptions): string[]{
        const args: string[] = [];

        for(const [key, value] of Object.entries(depotDownloaderArgs)){
            
            if(value === true){
                args.push(`-${key}`);
            }
            else if(value){
                args.push(`-${key}`);
                args.push(`${value}`);
            }
        }
        
        return args;
    }

}