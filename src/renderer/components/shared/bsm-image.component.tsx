import { CSSProperties, forwardRef, SyntheticEvent, useState } from "react";

type Props = {
    className?: string, 
    image: string, 
    errorImage?: string, 
    placeholder?: string, 
    loading?: "lazy"|"eager", 
    style?: CSSProperties
    title?: string,
    onClick?: (e: MouseEvent) => void 
}

export const BsmImage = forwardRef(({className, image, errorImage, placeholder, loading, style, title, onClick}: Props, ref) => {

    const [isLoaded, setIsLoaded] = useState(false);

    image = image || (placeholder||errorImage);

    const styles: CSSProperties = (() => {
        return {
            ...style,
            ...(!isLoaded && {backgroundImage: `url(${placeholder})`}),
            ...(!isLoaded && {backgroundSize: "cover"}),
            ...(!isLoaded && {backgroundPosition: "center"}),
        }
    })();

    const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = errorImage || "";
    }

    const handleLoaded = () => {
        setIsLoaded(() => true);
    }

    return (
        // @ts-ignore
        <img ref={ref} title={title} className={className} src={image} loading={loading} onLoad={handleLoaded} onError={handleError} style={styles} onClick={(e) => onClick?.(e)} alt=" " decoding="async"/>
    )
})
