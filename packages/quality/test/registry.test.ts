import { describe, expect, it } from "vitest";
import { applyRegistry, decodeRegistry } from "../src/exceptions/registry.ts";
import { levels, violation } from "./support/violations.ts";

const known = levels({ "biome/override": "error", "local/off": "off", "pragmas/ts-expect-error": "error" });
const pragma = violation({ file: "test/a.typecheck.ts", rule: "pragmas/ts-expect-error" });
const reason = "Compile-time proof that the types reject the value.";

describe("registry", () => {
	it("registers an exception by rule and file", () => {
		const checked = applyRegistry([pragma, pragma], [{ file: pragma.file, reason, rule: pragma.rule }], known);
		expect(checked).toEqual({ kept: [], registered: 2, stale: [] });
	});

	it("keeps a violation of another rule or file", () => {
		const other = violation({ file: "test/b.ts", rule: "pragmas/ts-expect-error" });
		const checked = applyRegistry([other], [{ file: pragma.file, reason, rule: pragma.rule }], known);
		expect(checked.kept).toEqual([other]);
		expect(checked.stale.map((stale) => stale.problem)).toEqual(["matches no violation"]);
	});

	it("matches the subject when an entry names one", () => {
		const any = violation({ file: "src/layer.ts", rule: "biome/override", subject: "suspicious/noExplicitAny" });
		const then = violation({ file: "src/layer.ts", rule: "biome/override", subject: "suspicious/noThenProperty" });
		const checked = applyRegistry(
			[any, then],
			[{ file: "src/layer.ts", reason, rule: "biome/override", subject: "suspicious/noExplicitAny" }],
			known,
		);
		expect(checked.kept).toEqual([then]);
		expect(checked.registered).toBe(1);
	});

	it("reports an entry that suppresses nothing as stale", () => {
		const checked = applyRegistry([], [{ file: "src/gone.ts", reason, rule: "pragmas/ts-expect-error" }], known);
		expect(checked.stale).toEqual([{ entry: { file: "src/gone.ts", reason, rule: "pragmas/ts-expect-error" }, problem: "matches no violation" }]);
	});

	it("reports a duplicate entry as stale", () => {
		const entry = { file: pragma.file, reason, rule: pragma.rule };
		expect(applyRegistry([pragma], [entry, { ...entry }], known).stale).toHaveLength(1);
	});

	it("reports entries for unknown and disabled rules", () => {
		const checked = applyRegistry(
			[],
			[
				{ file: "src/a.ts", reason, rule: "local/typo" },
				{ file: "src/a.ts", reason, rule: "local/off" },
			],
			known,
		);
		expect(checked.stale.map((stale) => stale.problem)).toEqual(["names no known rule", "names a rule that is off"]);
	});

	it("never covers a violation of a rule that takes no exceptions, and reports the entry", () => {
		const checked = applyRegistry([pragma], [{ file: pragma.file, reason, rule: pragma.rule }], levels({ [pragma.rule]: "error" }, { unregistrable: [pragma.rule] }));
		expect(checked.kept).toEqual([pragma]);
		expect(checked.stale.map((stale) => stale.problem)).toEqual([expect.stringContaining("names a rule that takes no exceptions")]);
	});
});

describe("registry file", () => {
	it("treats a missing file as no exceptions", async () => {
		expect(await decodeRegistry(undefined)).toEqual({ _tag: "Valid", value: [] });
	});

	it("reads entries with an optional subject", async () => {
		const raw = JSON.stringify([{ file: "a.ts", reason, rule: "biome/override", subject: "suspicious/noExplicitAny" }]);
		expect(await decodeRegistry(raw)).toEqual({ _tag: "Valid", value: JSON.parse(raw) });
	});

	it.each([
		["a missing reason", [{ file: "a.ts", rule: "x" }]],
		["a blank reason", [{ file: "a.ts", reason: "  ", rule: "x" }]],
		["an unknown field", [{ file: "a.ts", pragma: "@ts-expect-error", reason, rule: "x" }]],
		["an object instead of a list", { file: "a.ts", reason, rule: "x" }],
	])("rejects %s", async (_, entries) => {
		expect((await decodeRegistry(JSON.stringify(entries)))._tag).toBe("Invalid");
	});

	it("rejects text that is not JSON", async () => {
		expect((await decodeRegistry("[{"))._tag).toBe("Invalid");
	});
});
