import { BsmImage } from '../shared/bsm-image.component';
import './slideshow.component.css';

export function Slideshow(props: {className: string}) {

    const slideshowImages = [
        require('../../../../assets/images/slideshow-images/image-1-blur.jpg'),
        require('../../../../assets/images/slideshow-images/image-2-blur.jpg'),
        require('../../../../assets/images/slideshow-images/image-3-blur.jpg'),
        require('../../../../assets/images/slideshow-images/image-4-blur.jpg'),
        require('../../../../assets/images/slideshow-images/image-5-blur.png'),
        require('../../../../assets/images/slideshow-images/image-6-blur.png'),
        require('../../../../assets/images/slideshow-images/image-7-blur.png'),
      ];

  return (
    <div className={`slide ${props.className}`}>
      {
        slideshowImages.map((i, index) => <BsmImage key={i} className='w-full h-full object-cover' image={i} style={{animationDelay: `${index * 10}s`}}/>)
      }
    </div>
  )
}
