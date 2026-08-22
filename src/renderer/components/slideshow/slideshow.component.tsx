import { BsmImage } from "../shared/bsm-image.component";
import "./slideshow.component.css";
import image1 from "../../../../assets/images/slideshow-images/image-1-blur.jpg";
import image2 from "../../../../assets/images/slideshow-images/image-2-blur.jpg";
import image3 from "../../../../assets/images/slideshow-images/image-3-blur.jpg";
import image4 from "../../../../assets/images/slideshow-images/image-4-blur.jpg";
import image5 from "../../../../assets/images/slideshow-images/image-5-blur.jpg";
import image6 from "../../../../assets/images/slideshow-images/image-6-blur.jpg";
import image7 from "../../../../assets/images/slideshow-images/image-7-blur.jpg";

const slideshowImages = [image1, image2, image3, image4, image5, image6, image7];

export function Slideshow(props: { className: string }) {
    return (
        <div className={`slide ${props.className}`}>
            {slideshowImages.map((i, index) => (
                <BsmImage key={i} className="w-full h-full object-cover" image={i} style={{ animationDelay: `${index * 10}s` }} />
            ))}
        </div>
    );
}
