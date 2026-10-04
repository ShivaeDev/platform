import type { Bivariant } from "./index.ts";

function handleName(name: string): number {
	return name.length;
}

export const bivariant: { readonly handle: Bivariant<(value: unknown) => number> } = { handle: handleName };

export const strict: { readonly handle: (value: unknown) => number } = {
	// @ts-expect-error A function property checks its parameter strictly.
	handle: handleName,
};

export const returnChecked: { readonly handle: Bivariant<(value: unknown) => string> } = {
	// @ts-expect-error Bivariant keeps the return type covariant.
	handle: handleName,
};
