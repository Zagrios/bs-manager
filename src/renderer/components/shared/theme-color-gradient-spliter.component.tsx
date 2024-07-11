import { ComponentProps } from "react";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";

export function ThemeColorGradientSpliter(props: ComponentProps<"div">) {

    const colors = useThemeColor();

    return (
        <div {...props} style={{ backgroundImage: `linear-gradient(to right, ${colors.firstColor}, ${colors.secondColor})`}}/>
    )
}
