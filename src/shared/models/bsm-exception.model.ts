export interface BsmException extends Readonly<Omit<NodeJS.ErrnoException, "message">> {
    readonly title?: string;
    readonly message?: string;
}
