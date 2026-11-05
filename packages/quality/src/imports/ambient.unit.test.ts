import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { ambientModules } from "#imports/ambient.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const declared = ambientModules([{ path: "src/env.d.ts", syntax: sourceSyntax('declare module "virtual:config" {}') }]);

describe("ambient modules", () => {
	it.effect("declares a module for its exact name in its declaring project", function* () {
		yield* assertThat(declared("virtual:config", new Set(["src/env.d.ts"])), (actual) => actual.toBe(true));
	});

	it.effect("declares no module for a longer name that starts with the declared one", function* () {
		yield* assertThat(declared("virtual:configuration", new Set(["src/env.d.ts"])), (actual) => actual.toBe(false));
	});

	it.effect("declares no module in a project that does not hold the declaration", function* () {
		yield* assertThat(declared("virtual:config", new Set()), (actual) => actual.toBe(false));
	});
});
