import type { SeedFile } from "./tree.ts";

export const secondNameFiles: readonly (SeedFile & { readonly shape: string })[] = [
	{ content: 'import type { Original } from "./owner.ts";\nexport type Alias = Original;\n', path: "src/type.ts", shape: "type alias" },
	{
		content: 'import { original } from "./owner.ts";\nexport const alias: typeof original = original;\n',
		path: "src/value.ts",
		shape: "typeof const alias",
	},
	{
		content: 'import { read, write } from "./owner.ts";\nexport const facade = { read, save: write } as const;\n',
		path: "src/facade.ts",
		shape: "object facade",
	},
	{
		content: 'import { original } from "./owner.ts";\nexport function alias(value: string) { return original(value); }\n',
		path: "src/function.ts",
		shape: "forwarding declaration",
	},
	{
		content: 'import * as owner from "./owner.ts";\nexport const alias = (value: string) => owner.original(value);\n',
		path: "src/arrow.ts",
		shape: "forwarding arrow",
	},
];

export const realWrappers: SeedFile = {
	content: [
		'import { original, Record } from "./owner.ts";',
		"export const normalized = (value: string) => original(value.trim());",
		"export function logged(value: string) { console.log(value); return original(value); }",
		"export const configured = (value: string) => original(value, true);",
		"export const swapped = (left: string, right: string) => original(right, left);",
		"export const defaulted = (value = 'default') => original(value);",
		"export const shadowed = (original: (value: string) => string) => original(original);",
		"export async function promised(value: string) { return original(value); }",
		"export type Selected = Pick<Record, 'id'>;",
		"export type Refined = Record & { readonly extra: string };",
		"export function adapted(value: string): unknown;",
		"export function adapted(value: string) { return original(value); }",
		"const originalName = 1; export const localAlias = originalName;",
	].join("\n"),
	path: "src/wrappers.ts",
};

export const importForms: SeedFile = {
	content: [
		'import original from "./default.ts";',
		'import * as owner from "./owner.ts";',
		'import { original as imported } from "./renamed.ts";',
		"const alias = original; export { alias };",
		"export const facade = { ...owner };",
		"export const forward = (...args: string[]) => imported(...args);",
	].join("\n"),
	path: "src/forms.ts",
};

export const typeImportForms: SeedFile = {
	content: [
		'import type { First, Original as Renamed, Last } from "./owner.ts";',
		'import { type Other } from "./other.ts";',
		'import type Default from "./default.ts";',
		"export type Alias = Renamed;",
		"export type Another = Other;",
		"export type DefaultAlias = Default;",
		"export type Local = { readonly id: string };",
		'export type Selected = Pick<First, "id">;',
	].join("\n"),
	path: "src/typeForms.ts",
};
