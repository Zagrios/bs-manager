import { Subject, Subscription, filter } from "rxjs";
import { DeepLinkService } from "./deep-link.service";
import { buildUrl, isValidUrl } from "../../shared/helpers/url.helpers";

export class BsmProtocolService {

    private static instance: BsmProtocolService;

    public static getInstance(): BsmProtocolService{
        if(!BsmProtocolService.instance){ BsmProtocolService.instance = new BsmProtocolService(); }
        return BsmProtocolService.instance;
    }
    
    private readonly BSM_PROTOCOL = "bsmanager";

    private readonly deepLink: DeepLinkService;

    private linkeReceived$ = new Subject<URL>();

    private constructor(){
        this.deepLink = DeepLinkService.getInstance();

        this.registerBsmProtocol();

        this.deepLink.addLinkOpenedListener(this.BSM_PROTOCOL, link => {
            if(!isValidUrl(link)){ return; }
            this.linkeReceived$.next(new URL(link));
        });
    }

    private registerBsmProtocol(): boolean{
        if(this.deepLink.isDeepLinkRegistered(this.BSM_PROTOCOL)){ return true; }
        return this.deepLink.registerDeepLink(this.BSM_PROTOCOL);
    }

    public on(host: string, listener: (link: URL) => void): Subscription {
        return this.linkeReceived$.pipe(filter(link => link.host === host)).subscribe(listener);
    }

    public buildLink(host: string, params?: Record<string, string|string[]>): URL {
        return buildUrl({
            protocol: this.BSM_PROTOCOL,
            host,
            search: params
        });
    }

}