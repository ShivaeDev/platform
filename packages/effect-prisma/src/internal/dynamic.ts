const isObjectLike = (value: unknown): value is object => (typeof value === "object" && value !== null) || typeof value === "function";

export const hasMethod = (value: unknown, name: PropertyKey): value is object =>
	isObjectLike(value) && typeof Reflect.get(value, name) === "function";

export const invokeMethod = (target: object, name: PropertyKey, arguments_: ReadonlyArray<unknown>): unknown => {
	const method: unknown = Reflect.get(target, name);
	if (typeof method !== "function") {
		throw new TypeError(`${String(name)} is not a method`);
	}
	return Reflect.apply(method, target, arguments_);
};

export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => hasMethod(value, "then");

export const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> => hasMethod(value, Symbol.asyncIterator);
