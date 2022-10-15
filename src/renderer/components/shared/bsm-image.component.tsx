import { CSSProperties } from "react";

export function BsmImage({className, image, errorImage, placeholder, loading, style}: {className?: string, image: string, errorImage?: string, placeholder?: string, loading?: "lazy"|"eager", style?: CSSProperties}) {

  return (
    <img className={`${className} pointer-events-none`} src={image} loading={loading} onError={({currentTarget}) => { currentTarget.onerror = null; currentTarget.src = errorImage || "" }} style={{...style, backgroundImage: `url(${placeholder})`, backgroundSize: "cover"}} alt=""/>
  )
}
