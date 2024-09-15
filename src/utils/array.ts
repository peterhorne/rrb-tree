export const first = <T>(arr: T[]): T => arr[0]
export const last = <T>(arr: T[]): T => arr[arr.length - 1]
export const init = <T>(arr: T[]): T[] => arr.slice(0, -1)
export const tail = <T>(arr: T[]): T[] => arr.slice(1)
