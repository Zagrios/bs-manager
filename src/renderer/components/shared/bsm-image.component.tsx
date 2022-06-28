export function BsmImage({className, image, errorImage, placeholder, loading}: {className?: string, image: string, errorImage?: string, placeholder?: string, loading?: "lazy"|"eager"}) {

  return (
    <img className={className} src={image} loading={loading} onError={({currentTarget}) => { currentTarget.onerror = null; currentTarget.src = errorImage ? errorImage : "" }} style={{backgroundImage: `url(${placeholder})`, backgroundSize: "cover"}}/>
  )
}
