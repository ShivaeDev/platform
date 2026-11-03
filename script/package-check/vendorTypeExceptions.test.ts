import { expect } from "vitest";
import { declaration, vendorDeclarations } from "#package-check/test-support/vendorDeclarations.ts";

const NATIVE_DECLARATION = 'export type Settings = import("@vendor/engine").Options;';

vendorDeclarations.it(
	"accepts the exact dependency and files of a named exception",
	[declaration(`export type { Settings as NativeSettings } from "./native.js"; ${NATIVE_DECLARATION}`, { "native.ts": NATIVE_DECLARATION })],
	function* ({ checkNamedException }) {
		expect(yield* checkNamedException()).toEqual([]);
	},
);

vendorDeclarations.it(
	"a named exception does not allow a different engine or an extra core file",
	[
		declaration(
			`export type Peer = import("peer-engine").Options; export type { Extra } from "./extra.js"; export type { Settings as NativeSettings } from "./native.js"; ${NATIVE_DECLARATION}`,
			{
				"extra.ts": 'export type Extra = import("@vendor/engine").Options;',
				"native.ts": NATIVE_DECLARATION,
			},
		),
	],
	function* ({ checkNamedException }) {
		expect(yield* checkNamedException()).toEqual([
			"dist/extra.d.ts exposes @vendor/engine types; move the provider API under adapters/ or record a named vendor-type exception with its reason",
			"dist/library.d.ts exposes peer-engine types; move the provider API under adapters/ or record a named vendor-type exception with its reason",
		]);
	},
);

vendorDeclarations.it(
	"a named exception reports each file that no longer exposes its dependency",
	[declaration(NATIVE_DECLARATION)],
	function* ({ checkNamedException }) {
		expect(yield* checkNamedException()).toEqual([
			"remove stale vendor-type exception native-engine-options for dist/native.d.ts: The engine integration accepts native engine options.",
		]);
	},
);
