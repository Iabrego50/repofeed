// Server types - compatibility
export type FunctionReturnType<T> = T extends (...args: any[]) => Promise<infer R> ? R : never;
