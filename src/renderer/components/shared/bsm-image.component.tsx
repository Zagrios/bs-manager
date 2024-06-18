import { ComponentProps, CSSProperties, forwardRef, SyntheticEvent, useState } from "react";

type Props = {
    className?: string;
    image?: string;
    base64?: string;
    errorImage?: string;
    placeholder?: string;
    loading?: "lazy" | "eager";
    style?: CSSProperties;
    title?: string;
    onClick?: ComponentProps<"img">["onClick"]
};

export const BsmImage = forwardRef<HTMLImageElement, Props>(({ className, image, base64, errorImage, placeholder, loading, style, title, onClick }, ref) => {
    const [isLoaded, setIsLoaded] = useState(false);

    const getBase64Url = () => {

        if(base64?.startsWith("data:image")){ return base64; }
        return base64 ? `data:image/png;base64,${base64}` : undefined;
    };

    const imageSrc = image || getBase64Url() || placeholder || errorImage;

    const styles: CSSProperties = (() => {
        return {
            ...style,
            ...(!isLoaded && { backgroundImage: `url(${placeholder})` }),
            ...(!isLoaded && { backgroundSize: "cover" }),
            ...(!isLoaded && { backgroundPosition: "center" }),
        };
    })();

    const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = errorImage || "";
    };

    const handleLoaded = () => {
        setIsLoaded(() => true);
    };

    return <img ref={ref} title={title} className={className} src={imageSrc} loading={loading ?? "lazy"} onLoad={handleLoaded} onError={handleError} style={styles} onClick={e => onClick?.(e)} alt=" " decoding="async" />;
});
