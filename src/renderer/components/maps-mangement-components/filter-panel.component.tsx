import { MapFilter, MapTag } from "shared/models/maps/beat-saver.model"
import {motion} from "framer-motion"
import { MutableRefObject, useRef } from "react"
import { MAP_TYPES } from "renderer/partials/map-tags/map-types"
import { MAP_STYLES } from "renderer/partials/map-tags/map-styles"

export type Props = {
    className?: string,
    ref?: MutableRefObject<undefined>
    playlist?: boolean,
    filter?: MapFilter
    onChange?: () => void
}

export function FilterPanel({className, ref, playlist = false, filter, onChange}: Props) {

  return !playlist ? (
    <motion.div ref={ref} className={className} initial={{scale: 0}} animate={{scale: 1}} exit={{scale: 0}}>
        <div className="w-full h-full">
            <div className="flex flex-row flex-wrap grow">
                {[...MAP_TYPES, ...MAP_STYLES].map(tag => (
                    <span>{tag}</span>
                ))}
            </div>
        </div>
    </motion.div>
  ) : (
    <></>
  )
}
