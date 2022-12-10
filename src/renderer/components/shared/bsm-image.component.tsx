import { CSSProperties, SyntheticEvent, useState } from "react";

export function BsmImage({className, image, errorImage, placeholder, loading, style}: {className?: string, image: string, errorImage?: string, placeholder?: string, loading?: "lazy"|"eager", style?: CSSProperties}) {

    const [isLoaded, setIsLoaded] = useState(false);

    const styles: CSSProperties = (() => {
        return {
            ...style,
            ...(!isLoaded && {backgroundImage: `url(${placeholder})`}),
            ...(!isLoaded && {backgroundSize: "cover"})
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
        <img className={`${className} pointer-events-none`} src={image} loading={loading} onLoad={handleLoaded} onError={handleError} style={styles}/>
    )
}
