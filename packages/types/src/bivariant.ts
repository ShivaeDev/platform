declare class BivariantHost<Fn extends (...args: never[]) => unknown> {
	method(...args: Parameters<Fn>): ReturnType<Fn>;
}

export type Bivariant<Fn extends (...args: never[]) => unknown> = BivariantHost<Fn>["method"];
