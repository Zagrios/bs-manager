import { ConfigurationService } from "./configuration.service";

export class AuthUserService {

    private static instance: AuthUserService;

    private readonly configService: ConfigurationService;

    private readonly STEAM_USERNAME_KEY = "STEAM-USERNAME";

    public static getInstance(): AuthUserService{
        if(!AuthUserService.instance){ AuthUserService.instance = new AuthUserService() }
        return AuthUserService.instance;
    }

    private constructor(){
        this.configService = ConfigurationService.getInstance();
    }

    public sessionExist(): boolean{
        return !!this.configService.get(this.STEAM_USERNAME_KEY);
    }

    public setSteamSession(username: string, stay = true): void{
        this.configService.set(this.STEAM_USERNAME_KEY, username, stay);
    }

    public getSteamUsername(): string{ return this.configService.get(this.STEAM_USERNAME_KEY); }

    public deleteSteamSession(): void { this.configService.delete(this.STEAM_USERNAME_KEY); }
}