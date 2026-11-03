import { expect } from "vitest";
import { declaration, javascriptExport, vendorDeclarations, wildcardDeclarations } from "#package-check/test-support/vendorDeclarations.ts";

for (const [name, source] of [
	["named type import", 'import type { Options } from "@vendor/engine"; export interface Settings { readonly engine: Options }'],
	["namespace type import", 'import type * as Engine from "@vendor/engine"; export type Settings = Engine.Options;'],
	["inline import type", 'export type Settings = import("@vendor/engine").Options;'],
	["type re-export", 'export type { Options } from "@vendor/engine";'],
	["star re-export", 'export * from "@vendor/engine";'],
	["inferred return type", 'import { options } from "@vendor/engine"; export const settings = () => options();'],
] as const) {
	vendorDeclarations.it(`rejects a published ${name} from a runtime dependency`, [declaration(source)], function* ({ check }) {
		expect(yield* check()).toContain("dist/library.d.ts exposes @vendor/engine types");
	});
}

for (const dependency of ["peer-engine", "optional-engine"]) {
	vendorDeclarations.it(
		`rejects ${dependency} types in core`,
		[declaration(`export type Settings = import("${dependency}").Options;`)],
		function* ({ check }) {
			expect(yield* check()).toContain(`dist/library.d.ts exposes ${dependency} types`);
		},
	);
}

vendorDeclarations.it(
	"rejects an inferred type named by a transitive engine dependency",
	[declaration('import { result } from "@vendor/engine/result.js"; export const settings = () => result();')],
	function* ({ check }) {
		expect(yield* check()).toContain("dist/library.d.ts exposes transitive-engine types");
	},
);

vendorDeclarations.it(
	"follows private declarations reachable from a public export",
	[
		declaration('export type { Settings } from "./internal/settings.js";', {
			"internal/settings.ts": 'export type Settings = import("@vendor/engine").Options;',
		}),
	],
	function* ({ check }) {
		expect(yield* check()).toContain("dist/internal/settings.d.ts exposes @vendor/engine types");
	},
);

vendorDeclarations.it(
	"follows package imports to their emitted declaration target",
	[
		declaration('export type { Settings } from "#internal/settings.ts";', {
			"internal/settings.ts": 'export type Settings = import("@vendor/engine").Options;',
		}),
	],
	function* ({ check }) {
		expect(yield* check()).toContain("dist/internal/settings.d.ts exposes @vendor/engine types");
	},
);

vendorDeclarations.it(
	"an adapter entry does not exempt a core declaration it imports",
	[
		declaration('export type { Settings } from "./adapters/settings.js";', {
			"adapters/settings.ts": 'export type { Settings } from "../internal/settings.js";',
			"internal/settings.ts": 'export type Settings = import("@vendor/engine").Options;',
		}),
	],
	function* ({ check }) {
		expect(yield* check()).toContain("dist/internal/settings.d.ts exposes @vendor/engine types");
	},
);

for (const [name, source, modules] of [
	["Effect and workspace types", 'export type Settings = import("effect").Options & import("@shivaedev/service").Options;', {}],
	["development-only types", 'export type Settings = import("dev-engine").Options;', {}],
	["development-only type packages", 'export type Settings = import("dev-data").Options;', {}],
	["engine code erased from declarations", 'import { options } from "@vendor/engine"; export const timeout = (): number => options().timeout;', {}],
	[
		"unreachable private engine declarations",
		"export const timeout = 1;",
		{
			"internal/settings.ts": 'export type Settings = import("@vendor/engine").Options;',
		},
	],
	[
		"an adapter's public engine types",
		'export type { Settings } from "./adapters/settings.js";',
		{
			"adapters/settings.ts": 'export type Settings = import("@vendor/engine").Options;',
		},
	],
] as const) {
	vendorDeclarations.it(`accepts ${name}`, [declaration(source, modules)], function* ({ check }) {
		expect(yield* check()).toBeUndefined();
	});
}

vendorDeclarations.it(
	"rejects vendor declarations exposed only by a wildcard export",
	[declaration("export {};", { "public/settings.ts": 'export type Settings = import("@vendor/engine").Options;' }), wildcardDeclarations],
	function* ({ check }) {
		expect(yield* check()).toContain("dist/public/settings.d.ts exposes @vendor/engine types");
	},
);

vendorDeclarations.it(
	"checks declarations TypeScript resolves beside a JavaScript export",
	[declaration('export type Settings = import("@vendor/engine").Options;'), javascriptExport],
	function* ({ check }) {
		expect(yield* check()).toContain("dist/library.d.ts exposes @vendor/engine types");
	},
);

vendorDeclarations.it(
	"accepts vendor declarations hidden by a null export pattern",
	[declaration("export {};", { "internal/settings.ts": 'export type Settings = import("@vendor/engine").Options;' }), wildcardDeclarations],
	function* ({ check }) {
		expect(yield* check()).toBeUndefined();
	},
);
