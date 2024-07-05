import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn for classnames, merge tailwind classes with tailwind-merge and clsx
 * @param {ClassValue[]} classes
 * @returns {string}
 */
export function cn(...classes: ClassValue[]) {
    return twMerge(clsx(classes));
}
