export interface NumericBound {
	readonly $$typeof: symbol;
	readonly asymmetricMatch: (actual: unknown) => boolean;
	readonly getExpectedType: () => string;
	readonly toAsymmetricMatcher: () => string;
	readonly toString: () => string;
}

function bound(name: string, limit: number, compare: (actual: number, limit: number) => boolean): NumericBound {
	return {
		$$typeof: Symbol.for("jest.asymmetricMatcher"),
		asymmetricMatch: (actual) => typeof actual === "number" && compare(actual, limit),
		getExpectedType: () => "number",
		toAsymmetricMatcher: () => `${name}(${limit})`,
		toString: () => name,
	};
}

export function lessThan(limit: number) {
	return bound("lessThan", limit, (actual, value) => actual < value);
}

export function atMost(limit: number) {
	return bound("atMost", limit, (actual, value) => actual <= value);
}

export function greaterThan(limit: number) {
	return bound("greaterThan", limit, (actual, value) => actual > value);
}

export function atLeast(limit: number) {
	return bound("atLeast", limit, (actual, value) => actual >= value);
}
