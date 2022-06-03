import './slideshow.component.css';

export function Slideshow(props: {className: string, images: string[]}) {
  return (
    <div className={`slide ${props.className}`}>
      {
        props.images.map((i, index) => <img key={index} className='w-full h-full object-cover' src={i} style={{animationDelay: `${index * 10}s`}}></img>)
      }
    </div>
  )
}
