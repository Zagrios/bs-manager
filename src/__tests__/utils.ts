
export const ifDescribe = (condition: boolean) => condition ? describe : describe.skip;

export const ifIt = (condition: boolean) => condition ? it : it.skip;

