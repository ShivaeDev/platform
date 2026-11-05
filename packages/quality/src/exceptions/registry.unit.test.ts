import { describe, expect, it } from "vitest";
import { applyRegistry } from "#exceptions/registry.ts";
import { levels, violation } from "#test/violations.ts";

const known = levels({ "biome/override": "error", "pragmas/ts-expect-error": "error" });
const REASON = "Compile-time proof that the types reject the value.";
const pragma = violation({ file: "test/a.typecheck.ts", rule: "pragmas/ts-expect-error" });
const ENTRY = { file: pragma.file, reason: REASON, rule: pragma.rule };

describe("the registry", () => {
	it("registers every violation of the entry's rule in the entry's file", () => {
		expect(applyRegistry([pragma, pragma], [ENTRY], known)).toEqual({ kept: [], registered: 2, stale: [] });
	});

	it("keeps a violation of the entry's rule in another file and reports the entry as matching no violation", () => {
		const other = violation({ file: "test/b.ts", rule: pragma.rule });

		expect(applyRegistry([other], [ENTRY], known)).toEqual({
			kept: [other],
			registered: 0,
			stale: [{ entry: ENTRY, problem: "matches no violation" }],
		});
	});

	it("registers only the violation whose subject an entry names", () => {
		const any = violation({ file: "src/layer.ts", rule: "biome/override", subject: "suspicious/noExplicitAny" });
		const then = violation({ file: "src/layer.ts", rule: "biome/override", subject: "suspicious/noThenProperty" });
		const entry = { file: "src/layer.ts", reason: REASON, rule: "biome/override", subject: "suspicious/noExplicitAny" };

		expect(applyRegistry([any, then], [entry], known)).toEqual({ kept: [then], registered: 1, stale: [] });
	});

	it("reports the second of two identical entries as matching no violation", () => {
		const duplicate = { ...ENTRY };

		expect(applyRegistry([pragma], [ENTRY, duplicate], known).stale).toEqual([{ entry: duplicate, problem: "matches no violation" }]);
	});

	it("reports an entry for an unknown rule", () => {
		const typo = { file: "src/a.ts", reason: REASON, rule: "local/typo" };

		expect(applyRegistry([], [typo], known).stale).toEqual([{ entry: typo, problem: "names no known rule" }]);
	});

	it("keeps a violation of a rule that takes no exceptions and reports the entry for it", () => {
		const checked = applyRegistry([pragma], [ENTRY], levels({ [pragma.rule]: "error" }, { unregistrable: [pragma.rule] }));

		expect(checked).toEqual({
			kept: [pragma],
			registered: 0,
			stale: [{ entry: ENTRY, problem: expect.stringContaining("names a rule that takes no exceptions") }],
		});
	});
});
