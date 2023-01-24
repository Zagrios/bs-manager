export interface PartialBSVersion {
    BSVersion: string,
    name?: string
}

export interface BSVersion extends PartialBSVersion {
   BSManifest?: string,
   ReleaseURL?: string,
   ReleaseImg?: string,
   ReleaseDate?: string,
   year?: string,
   steam?: boolean,
   oculus?: boolean,
   color?: string
}