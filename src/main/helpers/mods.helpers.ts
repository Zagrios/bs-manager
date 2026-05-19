import { readFile } from "fs-extra";
import { ModMetadata } from "shared/models/mods/mod.interface";

// NOTE: getMetadata is slow since its using a search string and object parsing.
// Ways to optimize:
//  - Find a way to locate the metadata string within the pdb/dll file
//  - Correct object sizing, since the first byte does not match sometimes with the size somehow

// ref: https://raw.githubusercontent.com/bsmg/BSIPA-MetadataFileSchema/master/Schema.json
const SEARCH_ARRAY = [
    0x22, 0x24, 0x73, 0x63, 0x68,
    0x65, 0x6D, 0x61, 0x22
].reverse(); // '"$schema"'

export async function parseMetadata(filepath: string): Promise<ModMetadata | null> {
    const data = await readFile(filepath);

    // Find the word SEARCH_ARRAY from end to start of the buffer data
    // NOTE: Inefficient algorithm
    let start = data.length - 1;
    for (let i = 0; start >= 0; --start) {
      if (data[start] !== SEARCH_ARRAY[i]) {
        i = 0;
      } else if (++i === SEARCH_ARRAY.length) {
        break;
      }
    }

    if (start < 4) {
        return null;
    }

    // Search for the starting left curly brace '{'
    while (data[--start] !== 0x7B);

    // Find the ending right curly brace '}'
    // NOTE: Inefficient algorithm
    let braces = 1;
    let end = start + 1;
    for (; end < data.length && braces > 0; ++end) {
        if (data[end] === 0x7B) { // {
            ++braces;
        } else if (data[end] === 0x7D) { // }
            --braces;
        }
    }

    // Does not work with every dll (eg. Bugsmash.dll)
    // const length = (data[start - 1] << 24)
    //              + (data[start - 2] << 16)
    //              + (data[start - 3] <<  8)
    //              + (data[start - 4]);
    // const end = start + length;

    return JSON.parse(data.toString(undefined, start, end)) as ModMetadata;
}

