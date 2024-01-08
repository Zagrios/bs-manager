// These types and functions are meant replace the current clunky SVG system (the one with `bsm-icon.component.tsx`) 

import { ForwardedRef, forwardRef } from "react"

export type SvgIcon = React.ForwardRefExoticComponent<Omit<React.SVGProps<SVGSVGElement>, "ref"> & React.RefAttributes<SVGSVGElement>>;
export type SvgRenderFunction = (props: React.SVGProps<SVGSVGElement>, ref: ForwardedRef<SVGSVGElement>) => JSX.Element;

export function createSvgIcon(render: SvgRenderFunction): SvgIcon {
    return forwardRef(render);
}