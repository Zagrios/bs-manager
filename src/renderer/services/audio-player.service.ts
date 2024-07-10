import { BehaviorSubject, Observable, map } from 'rxjs';
import { ConfigurationService } from './configuration.service';
import { logRenderError } from 'renderer';

interface PlayerVolume {
    volume: number;
    muted: boolean;
}

interface PlayerSound {
    src: string;
    bpm?: number;
}

export class AudioPlayerService {
    private static instance: AudioPlayerService;

    public static getInstance(): AudioPlayerService {
        if (!AudioPlayerService.instance) {
            AudioPlayerService.instance = new AudioPlayerService();
        }
        return AudioPlayerService.instance;
    }

    private player = new Audio();
    private config = ConfigurationService.getInstance();

    private _soundsIndex$ = new BehaviorSubject<number>(0);
    private _sounds$ = new BehaviorSubject<PlayerSound[]>([]);
    private _currentSound$ = this._soundsIndex$.pipe(
        map(index => this._sounds$.value[index]),
    );

    private _playing$ = new BehaviorSubject<boolean>(false);
    private _bpm$ = new BehaviorSubject<number>(0);
    private _volume$ = new BehaviorSubject<PlayerVolume>(
        this.config.get<PlayerVolume>('audio-level') || { volume: 0.5, muted: false },
    );

    private constructor() {
        this.player.onplay = () => this._playing$.next(true);
        this.player.onpause = () => this._playing$.next(false);
        this.player.onended = () => {
            this._playing$.next(false);
            const nextIndex = (this._soundsIndex$.value + 1) % this._sounds$.value.length;
            if (nextIndex !== 0 || this._sounds$.value.length > 1) {
                this._soundsIndex$.next(nextIndex);
            }
        };

        this._currentSound$.subscribe(sound => {
            if(!sound){ return; }
            this.player.src = sound.src;
            this._bpm$.next(sound.bpm || 0);
            this.player.play().catch(logRenderError);
        });

        this._volume$.subscribe(volume => {
            this.player.volume = volume.volume;
            this.player.muted = volume.muted;
            this.config.set('audio-level', volume);
        });
    }

    public play(sounds: PlayerSound[]): void {
        this.pause();
        this._sounds$.next(sounds);
        this._soundsIndex$.next(0); // Ensures we start from the first sound
    }

    public pause(): void {
        this._playing$.next(false);
        this.player.pause();
    }

    public resume(): Promise<void> {
        if(this._playing$.value){
            return Promise.resolve();
        }

        return this.player.play().then(() => {
            this._playing$.next(true);
        }).catch(logRenderError);
    }

    public setVolume(volume: number): void {
        const playerVolume: PlayerVolume = { muted: volume <= 0, volume };
        this._volume$.next(playerVolume);
    }

    public mute(): void {
        const playerVolume = { ...this._volume$.value, muted: true };
        this._volume$.next(playerVolume);
    }

    public unmute(): void {
        const playerVolume = { ...this._volume$.value, muted: false };
        this._volume$.next(playerVolume);
    }

    public toggleMute(): void {
        const isMuted = this._volume$.value.muted;
        if (isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
    }

    // Getter methods to expose Observables for external use
    public get src$(): Observable<string> {
        return this._currentSound$.pipe(map(sound => sound?.src || ''));
    }

    public get playing$(): Observable<boolean> {
        return this._playing$.asObservable();
    }

    public get bpm$(): Observable<number> {
        return this._bpm$.asObservable();
    }

    public get volume$(): Observable<PlayerVolume> {
        return this._volume$.asObservable();
    }

    public get src(): string {
        return this.player.src;
    }

    public get playing(): boolean {
        return this._playing$.value;
    }

    public get bpm(): number {
        return this._bpm$.value;
    }

    public get volume(): PlayerVolume {
        return this._volume$.value;
    }

    public get muted(): boolean {
        return this.player.muted;
    }
}
