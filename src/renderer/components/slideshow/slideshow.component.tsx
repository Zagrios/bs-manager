import { BsmImage } from '../shared/bsm-image.component';
import './slideshow.component.css';

export function Slideshow(props: {className: string, images: string[]}) {
  return (
    <div className={`slide ${props.className}`}>
      {
        props.images.map((i, index) => <BsmImage key={i} className='w-full h-full object-cover' image={i} style={{animationDelay: `${index * 10}s`}}/>)
      }
    </div>
  )
}
