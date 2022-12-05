import { get } from "https";
import { createWriteStream, unlink } from "fs";

export class RequestService {

    private static instance: RequestService;

    public static getInstance(): RequestService{
        if(!RequestService.instance){ RequestService.instance = new RequestService(); }
        return RequestService.instance;
    }

    private constructor(){}

    public get<T = any>(url: string): Promise<T>{
        return new Promise((resolve, reject) => {
            let body = ''
            get(url, (res) => {
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    resolve(JSON.parse(body));
                });
                res.on('error', (err) => reject(err))
            });
        });
    }
    
    public downloadFile(url: string, dest: string): Promise<string>{
        return new Promise((resolve, reject) => {

            const file = createWriteStream(dest);
            get(url, res => {
                res.pipe(file);
                file.on("close", () => {
                    file.close(() => resolve(dest))
                }).on("error", err => {
                    unlink(dest, () => reject(err));
                });
            }).on("error", err => {
                unlink(dest, () => reject(err));
            });
        });
    }

}