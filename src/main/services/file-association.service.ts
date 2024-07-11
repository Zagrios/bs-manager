import { pathExistsSync } from "fs-extra";
import path from "path";
import log from "electron-log";

export class FileAssociationService {
    private static instance: FileAssociationService;

    public static getInstance(): FileAssociationService {
        if (!FileAssociationService.instance) {
            FileAssociationService.instance = new FileAssociationService();
        }
        return FileAssociationService.instance;
    }

    private readonly listeners = new Map<ExtKey, Listerner[]>();

    private constructor() {}

    private getAbsolutePath(filePath: string) {
        return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    }

    public registerFileAssociation(ext: ExtKey, fn: Listerner) {
        if (!this.listeners.has(ext)) {
            this.listeners.set(ext, [] as Listerner[]);
        }

        this.listeners.get(ext).push(fn);
    }

    public isFileAssociated(filePath: string): boolean {
        const fileExt = path.extname(filePath) as ExtKey;
        return this.listeners.has(fileExt);
    }

    public handleFileAssociation(filePath: string) {
        const absolutePath = this.getAbsolutePath(filePath);

        if(!pathExistsSync(absolutePath)) {
            log.error(`[FileAssociationService] File not found: ${absolutePath}`);
            return;
        }

        const fileExt = path.extname(absolutePath) as ExtKey;
        const listeners = this.listeners.get(fileExt);

        if (!listeners) {
            log.error(`[FileAssociationService] No listeners for file: ${absolutePath}`);
            return;
        }

        listeners.forEach(listener => listener(this.getAbsolutePath(filePath)));
    }
}
type ExtKey = `.${string}`;
type Listerner = (filePath: string) => void;
