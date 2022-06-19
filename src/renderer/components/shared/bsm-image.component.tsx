export function BsmImage({className, image, errorImage, loading}: {className?: string, image: string, errorImage?: string, loading?: "lazy"|"eager"}) {

  return (
    <img className={className} src={image} loading={loading} onError={({currentTarget}) => { currentTarget.onerror = null; currentTarget.src = errorImage ? errorImage : "" }}/>
  )
}
