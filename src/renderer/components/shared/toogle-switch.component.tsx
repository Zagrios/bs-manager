import { useMemo } from "react"
import { getCorrectTextColor } from "renderer/helpers/correct-text-color";
import { cn } from "renderer/helpers/css-class.helpers";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";

type Props = {
    checked?: boolean;
    className?: string;
    classNames?: {
        container?: string;
        dot?: string;
        active?: string;
        inactive?: string;
    }
    bgColor?: string;
    onChange?: (isChecked: boolean) => void;
}

export function ToogleSwitch({ checked, className, classNames, bgColor, onChange }: Readonly<Props>) {

    const uuid = useConstant(() => crypto.randomUUID());
    const { firstColor } = useThemeColor();
    const backgroundColor = useMemo(() => bgColor ?? firstColor, [bgColor, firstColor]);
    const dotColor = useMemo(() => {
        return getCorrectTextColor(backgroundColor);
    }, [backgroundColor]);
    const textColor = useMemo(() => {
        return getCorrectTextColor(dotColor)
    }, [dotColor]);

    const handleCheckboxChange = () => {
        onChange?.(!checked);
    }

    return (
        <label className={cn("flex cursor-pointer select-none items-center h-8 w-14", className, classNames?.container)} htmlFor={uuid}>
            <div className='relative size-full rounded-full p-1 bg-neutral-500 transition-colors duration-200' style={{ backgroundColor: checked && backgroundColor }}>
                <input
                    id={uuid}
                    type='checkbox'
                    checked={checked}
                    onChange={handleCheckboxChange}
                    className='sr-only peer'
                />
                <div
                    className={cn("dot top-0 left-0 flex h-full aspect-square items-center justify-center rounded-full transition duration-200 peer-checked:translate-x-full", classNames?.dot)}
                    style={{ backgroundColor:  dotColor }}
                >
                    {checked && <span className="text-current" style={{ color: textColor }}>
                        <svg
                            width='11'
                            height='8'
                            viewBox='0 0 11 8'
                            fill='none'
                        >
                            <path
                                d='M10.0915 0.951972L10.0867 0.946075L10.0813 0.940568C9.90076 0.753564 9.61034 0.753146 9.42927 0.939309L4.16201 6.22962L1.58507 3.63469C1.40401 3.44841 1.11351 3.44879 0.932892 3.63584C0.755703 3.81933 0.755703 4.10875 0.932892 4.29224L0.932878 4.29225L0.934851 4.29424L3.58046 6.95832C3.73676 7.11955 3.94983 7.2 4.1473 7.2C4.36196 7.2 4.55963 7.11773 4.71406 6.9584L10.0468 1.60234C10.2436 1.4199 10.2421 1.1339 10.0915 0.951972ZM4.2327 6.30081L4.2317 6.2998C4.23206 6.30015 4.23237 6.30049 4.23269 6.30082L4.2327 6.30081Z'
                                fill='currentColor'
                                stroke='currentColor'
                                strokeWidth='0.4'
                            />
                        </svg>
                    </span>}
                    {!checked && <span className="text-current" style={{ color: textColor }}>
                        <svg
                            className='h-4 w-4 stroke-current'
                            fill='black'
                            viewBox='0 0 24 24'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M6 18L18 6M6 6l12 12'
                            />
                        </svg>
                    </span>}
                </div>
            </div>
        </label>
    )
}
