import { Observable, BehaviorSubject } from "rxjs";
import { ConfigurationService } from "./configuration.service";

export class AudioPlayerService{

    private static instance: AudioPlayerService;

    public static getInstance(): AudioPlayerService{
        if(!AudioPlayerService.instance){ AudioPlayerService.instance = new AudioPlayerService(); }
        return AudioPlayerService.instance;
    }

    private readonly config: ConfigurationService;

    private readonly player: HTMLAudioElement;

    private readonly _src$: BehaviorSubject<string> = new BehaviorSubject("");
    private readonly _playing$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    private readonly _bpm$: BehaviorSubject<number> = new BehaviorSubject(0);
    private readonly _volume$: BehaviorSubject<PlayerVolume>;

    private lastVolume: number;

    private constructor(){

        this.config = ConfigurationService.getInstance();

        this._volume$ = new BehaviorSubject(
            this.config.get<PlayerVolume>("audio-level") || { volume: 0.5, muted: false } 
        );

        this.lastVolume = this._volume$.value.volume;

        this.player = new Audio();

        this.player.onplay = () => this._playing$.next(true);
        this.player.onpause = () => this._playing$.next(false);
        this.player.onended = () => this._playing$.next(false);

        this._volume$.subscribe(volume => {
            this.player.volume = volume.volume;
            this.player.muted = volume.muted;
            this.config.set("audio-level", volume);
        });
    }

    public play(src: string, bpm = 0): Promise<void>{
        this.pause();
        this.player.src = src;
        this._src$.next(src);
        this._bpm$.next(bpm)
        return this.player.play()
    }

    public pause(): void{
        this._playing$.next(false);
        this.player.pause();
    }

    public resume(): Promise<void>{
        return this.player.play();
    }

    public setVolume(volume: number): void{
        const playerVolume: PlayerVolume = {muted: volume <= 0, volume};
        this._volume$.next(playerVolume);
    }

    public setFinalVolume(volume: number): void{
        if(volume > 0){ this.lastVolume = volume; }
        const playerVolume: PlayerVolume = {muted: volume <= 0, volume: this.lastVolume};
        this._volume$.next(playerVolume);
    }

    public mute(): void{
        const playerVolume = {...this._volume$.value, muted: true};
        this._volume$.next(playerVolume);
    }

    public unmute(): void{
        const playerVolume = {...this._volume$.value, muted: false};
        this._volume$.next(playerVolume);
    }
    
    public toggleMute(): void{
        this.muted ? this.unmute() : this.mute();
    }

    public get src$(): Observable<string>{
        return this._src$.asObservable();
    }
    public get playing$(): Observable<boolean>{
        return this._playing$.asObservable();
    }
    public get bpm$(): Observable<number>{
        return this._bpm$.asObservable();
    }
    public get volume$(): Observable<PlayerVolume>{
        return this._volume$.asObservable();
    }

    public get src(): string{ return this._src$.value; }
    public get playing(): boolean{ return this._playing$.value; }
    public get bpm(): number{ return this._bpm$.value; }
    public get volume(): PlayerVolume{ return this._volume$.value; }
    public get muted(): boolean{ return this.player.muted; }

}

interface PlayerVolume{
    volume: number;
    muted: boolean;
}