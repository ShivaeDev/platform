import type { SeedFile } from "#testing/adapters/tree.ts";

type ShapedFile = SeedFile & { readonly shape: string };

export const secondNameFiles: readonly ShapedFile[] = [
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

export const localAliasFacade: SeedFile = {
	content: [
		'import { original } from "./owner.ts";',
		"const direct: typeof original = original;",
		"const next = direct;",
		"export const facade = { read: next };",
	].join("\n"),
	path: "src/chain.ts",
};

const APP_MODULE = 'import type { AppModule } from "@shivaedev/server/AppModule.ts";';
const WATER = ['import { Water } from "./water.ts";', 'import { waterRepositories } from "./waterRepositories.ts";'];

function registrationFile(name: string, shape: string, ...lines: readonly string[]): ShapedFile {
	return { content: `${lines.join("\n")}\n`, path: `src/server/${name}.ts`, shape };
}

export const registrationFiles: readonly ShapedFile[] = [
	registrationFile(
		"water",
		"water",
		APP_MODULE,
		...WATER,
		"export const water = { module: Water, services: waterRepositories } satisfies AppModule;",
	),
	registrationFile(
		"household",
		"household",
		'import { Layer } from "effect";',
		APP_MODULE,
		'import { Household } from "./household.ts";',
		"export const household = { module: Household, services: Layer.empty } satisfies AppModule;",
	),
	registrationFile(
		"training",
		"training",
		APP_MODULE,
		'import { Training } from "./training.ts";',
		'import { TrainingTables } from "./trainingTables.ts";',
		"export const training = { module: Training, services: TrainingTables.layer } satisfies AppModule;",
	),
	registrationFile(
		"namespaced",
		"namespace-imported AppModule",
		'import type * as Server from "@shivaedev/server/AppModule.ts";',
		...WATER,
		"export const water = { module: Water, services: waterRepositories } satisfies Server.AppModule;",
	),
	registrationFile(
		"listed",
		"later exported",
		APP_MODULE,
		...WATER,
		"const registered = ({ module: Water, services: waterRepositories }) satisfies AppModule;",
		"export { registered as water };",
	),
	registrationFile(
		"usage",
		"admin-only",
		APP_MODULE,
		'import { usageAdmin } from "./usageAdmin.ts";',
		"export const usage = { admin: usageAdmin } satisfies AppModule;",
	),
];

export const facadeFiles: readonly ShapedFile[] = [
	registrationFile(
		"api",
		"written satisfies Api",
		'import { create, list } from "./operations.ts";',
		'import type { Api } from "./api.ts";',
		"export const api = { list, create } satisfies Api;",
	),
	registrationFile(
		"cast",
		"cast as AppModule",
		APP_MODULE,
		...WATER,
		"export const water = { module: Water, services: waterRepositories } as AppModule;",
	),
	registrationFile(
		"annotated",
		"typed AppModule",
		APP_MODULE,
		...WATER,
		"export const water: AppModule = { module: Water, services: waterRepositories };",
	),
	registrationFile("unchecked", "with no satisfies", ...WATER, "export const water = { module: Water, services: waterRepositories };"),
	registrationFile(
		"local",
		"written satisfies an AppModule of its own",
		'import type { AppModule } from "./AppModule.ts";',
		...WATER,
		"export const water = { module: Water, services: waterRepositories } satisfies AppModule;",
	),
];
