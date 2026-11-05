import { describe } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { applyRegistry, decodeRegistry } from "#exceptions/registry.ts";
import { levels, violation } from "#test/violations.ts";

const known = levels({ "biome/override": "error", "pragmas/ts-expect-error": "error" });
const REASON = "Compile-time proof that the types reject the value.";
const pragma = violation({ file: "test/a.typecheck.ts", rule: "pragmas/ts-expect-error" });
const ENTRY = { file: pragma.file, reason: REASON, rule: pragma.rule };

describe("the registry", () => {
	it.effect("registers every violation of the entry's rule in the entry's file", function* () {
		yield* assertThat(applyRegistry([pragma, pragma], [ENTRY], known), (actual) => actual.toEqual({ kept: [], registered: 2, stale: [] }));
	});

	it.effect("keeps a violation of the entry's rule in another file and reports the entry as matching no violation", function* () {
		const other = violation({ file: "test/b.ts", rule: pragma.rule });

		yield* assertThat(applyRegistry([other], [ENTRY], known), (actual) =>
			actual.toEqual({
				kept: [other],
				registered: 0,
				stale: [{ entry: ENTRY, problem: "matches no violation" }],
			}),
		);
	});

	it.effect("registers only the violation whose subject an entry names", function* () {
		const any = violation({ file: "src/layer.ts", rule: "biome/override", subject: "suspicious/noExplicitAny" });
		const then = violation({ file: "src/layer.ts", rule: "biome/override", subject: "suspicious/noThenProperty" });
		const entry = { file: "src/layer.ts", reason: REASON, rule: "biome/override", subject: "suspicious/noExplicitAny" };

		yield* assertThat(applyRegistry([any, then], [entry], known), (actual) => actual.toEqual({ kept: [then], registered: 1, stale: [] }));
	});

	it.effect("reports the second of two identical entries as matching no violation", function* () {
		const duplicate = { ...ENTRY };

		yield* assertThat(applyRegistry([pragma], [ENTRY, duplicate], known).stale, (actual) =>
			actual.toEqual([{ entry: duplicate, problem: "matches no violation" }]),
		);
	});

	it.effect("reports an entry for an unknown rule", function* () {
		const typo = { file: "src/a.ts", reason: REASON, rule: "local/typo" };

		yield* assertThat(applyRegistry([], [typo], known).stale, (actual) => actual.toEqual([{ entry: typo, problem: "names no known rule" }]));
	});

	it.effect("keeps a violation of a rule that takes no exceptions and reports the entry for it", function* () {
		const checked = applyRegistry([pragma], [ENTRY], levels({ [pragma.rule]: "error" }, { unregistrable: [pragma.rule] }));

		yield* assertThat(checked, (actual, expect) =>
			actual.toEqual({
				kept: [pragma],
				registered: 0,
				stale: [{ entry: ENTRY, problem: expect.stringContaining("names a rule that takes no exceptions") }],
			}),
		);
	});
});

describe("the registry file", () => {
	it.effect("is empty when it is missing", function* () {
		yield* assertThat(yield* Effect.promise(() => decodeRegistry(undefined)), (actual) => actual.toEqual({ _tag: "Valid", value: [] }));
	});

	it.effect.each([
		["a missing reason", JSON.stringify([{ file: "a.ts", rule: "x" }])],
		["a blank reason", JSON.stringify([{ file: "a.ts", reason: "  ", rule: "x" }])],
		["an unknown field", JSON.stringify([{ file: "a.ts", pragma: "@ts-expect-error", reason: REASON, rule: "x" }])],
		["an object instead of a list", JSON.stringify({ file: "a.ts", reason: REASON, rule: "x" })],
		["text that is not JSON", "[{"],
	] satisfies ReadonlyArray<readonly [unknown, unknown]>)("is refused with %s", function* ([_, text]) {
		yield* assertThat(yield* Effect.promise(() => decodeRegistry(text)), (actual) => actual.toMatchObject({ _tag: "Invalid" }));
	});
});
