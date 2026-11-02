import type { Bivariant } from "./Bivariant.ts";

function handleName(name: string): number {
	return name.length;
}

export const bivariant: { readonly handle: Bivariant<(value: unknown) => number> } = { handle: handleName };

export const result = bivariant.handle("Ada");
export const checkedResult: number = result;

// @ts-expect-error Bivariant keeps the called result typed as number.
export const incompatibleResult: string = result;

export const strict: { readonly handle: (value: unknown) => number } = {
	// @ts-expect-error A function property checks its parameter strictly.
	handle: handleName,
};

export const returnChecked: { readonly handle: Bivariant<(value: unknown) => string> } = {
	// @ts-expect-error Bivariant keeps the return type covariant.
	handle: bivariant.handle,
};
