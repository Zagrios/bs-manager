// These types and functions are meant replace the current clunky SVG system (the one with `bsm-icon.component.tsx`)

import { ForwardRefExoticComponent, ForwardedRef, RefAttributes, SVGProps, forwardRef } from "react"


export type SvgIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>>;
export type SvgRenderFunction = (props: SVGProps<SVGSVGElement>, ref?: ForwardedRef<SVGSVGElement>) => JSX.Element;

export function createSvgIcon(render: SvgRenderFunction): SvgIcon {
    return forwardRef(render);
}
