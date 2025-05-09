import log from "electron-log";
import { createServer, Server, Socket } from "net";

export class BSMHookService {
    private static instance: BSMHookService;
    private server: Server;
    private onData?: (data: Buffer) => void;
    private onError?: (err: Error) => void;
    private sockets: Set<Socket> = new Set();

    public static getInstance(): BSMHookService {
        if (!BSMHookService.instance) {
            BSMHookService.instance = new BSMHookService();
        }
        return BSMHookService.instance;
    }

    private constructor() {
        this.server = createServer(socket => {
            this.sockets.add(socket);

            socket.on("data", data => {
                log.info(`Received BSMHook data: ${data}`);
                this.onData?.(data);
            });

            socket.on("error", err => {
                log.error(`Socket error: ${err.message}`);
                this.onError?.(err);
                this.server?.close();
            });

            socket.on("close", () => {
                log.info("BSMHook socket closed");
                this.onData = undefined;
                this.onError = undefined;
            });
        });
    }

    public start(onData?: (data: Buffer) => void, onError?: (err: Error) => void) {
        this.onData = onData;
        this.onError = onError;
        this.server.listen(58127, "127.0.0.1", () => {
            log.info("BSMHook socket server listening on 127.0.0.1:58127");
        });
    }

    public close() {
        this.server.close();
        this.server.removeAllListeners();

        this.sockets.forEach(socket => {
            socket.write('bye');
        });
        this.sockets.clear();
    }
}
