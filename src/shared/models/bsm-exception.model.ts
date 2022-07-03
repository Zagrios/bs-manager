export interface BsmException {
    type: "error"|"warning"
    title: string,
    msg?: string,
}