declare class BivariantHost<TFn extends (...args: never[]) => unknown> {
	method(...args: Parameters<TFn>): ReturnType<TFn>;
}

export type Bivariant<TFn extends (...args: never[]) => unknown> = BivariantHost<TFn>["method"];
