type Operator = "gt" | "gte" | "in" | "like" | "lt" | "lte" | "not";

// An operator object is a list, a not-null test, or ranges with a pattern; each shape rules out the keys of the others.
export type Without<TKeys extends Operator> = { readonly [TKey in TKeys]?: never };
export type Listed<T> = { readonly in: readonly T[] } & Without<Exclude<Operator, "in">>;
export type Pattern<T> = [NonNullable<T>] extends [string] ? { readonly like?: NonNullable<T> } : { readonly like?: never };
export type NotNull<T> = [null] extends [T] ? { readonly not: null } & Without<Exclude<Operator, "not">> : never;
