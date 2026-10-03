import { describe, expect, it } from "vitest";
import { adopt, prune } from "../src/baseline/update.ts";
import { levels, violation } from "./support/violations.ts";

const known = levels({ "local/new": "error", "local/off": "off", "local/todo": "warn", "structure/max-lines": "error" });
const long = violation({ count: 262, file: "src/big.ts", rule: "structure/max-lines", threshold: 150 });
const fresh = violation({ file: "src/a.ts", rule: "local/new" });
const warned = violation({ file: "src/a.ts", level: "warn", rule: "local/todo" });

describe("baseline write", () => {
	it("records every error-level violation when no baseline exists", () => {
		expect(adopt(undefined, [], [long, fresh, fresh, warned], known)).toEqual({
			_tag: "Adopted",
			added: 2,
			replaced: 0,
			entries: [
				{ count: 262, file: "src/big.ts", rule: "structure/max-lines" },
				{ count: 2, file: "src/a.ts", rule: "local/new" },
			],
		});
	});

	it("adopts a named rule into an existing baseline and leaves other entries alone", () => {
		const existing = [{ count: 250, file: "src/big.ts", rule: "structure/max-lines" }];
		const adoption = adopt(existing, ["local/new"], [long, fresh], known);
		expect(adoption).toEqual({ _tag: "Adopted", added: 1, entries: [...existing, { count: 1, file: "src/a.ts", rule: "local/new" }], replaced: 0 });
	});

	it("records a rule it already covers again, replacing its entries", () => {
		const existing = [
			{ count: 12, file: "src/big.ts", rule: "structure/max-lines" },
			{ count: 5, file: "src/gone.ts", rule: "structure/max-lines" },
			{ count: 2, file: "src/a.ts", rule: "local/new" },
		];
		expect(adopt(existing, ["structure/max-lines"], [long, fresh], known)).toEqual({
			_tag: "Adopted",
			added: 1,
			entries: [existing[2], { count: 262, file: "src/big.ts", rule: "structure/max-lines" }],
			replaced: 2,
		});
	});

	it("never records a finding that counts no violations", () => {
		const within = violation({ count: 0, file: "src/a.ts", rule: "local/new" });
		expect(adopt(undefined, [], [within], known)).toEqual({ _tag: "Adopted", added: 0, entries: [], replaced: 0 });
	});

	it.each([
		["a rule at warn", "local/todo", "Set it to error"],
		["a rule that is off", "local/off", "Set it to error"],
		["an unknown rule", "local/typo", "no built-in or local rule"],
	])("refuses %s", (_, rule, reason) => {
		const adoption = adopt([{ count: 1, file: "src/big.ts", rule: "structure/max-lines" }], [rule], [long, fresh], known);
		expect(adoption).toEqual({ _tag: "Refused", reasons: [expect.stringContaining(reason)] });
	});
});

describe("baseline prune", () => {
	it("drops fixed debt and lowers what shrank", () => {
		const pruned = prune(
			[
				{ count: 1, file: "src/gone.ts", rule: "local/new" },
				{ count: 3, file: "src/a.ts", rule: "local/new" },
				{ count: 350, file: "src/big.ts", rule: "structure/max-lines" },
			],
			[fresh, long],
			known,
		);
		expect(pruned).toEqual({
			entries: [
				{ count: 1, file: "src/a.ts", rule: "local/new" },
				{ count: 262, file: "src/big.ts", rule: "structure/max-lines" },
			],
			lowered: 2,
			moved: 0,
			removed: 1,
		});
	});

	it("never raises an entry for a file that got worse", () => {
		const existing = [{ count: 150, file: "src/big.ts", rule: "structure/max-lines" }];
		expect(prune(existing, [long], known)).toEqual({ entries: existing, lowered: 0, moved: 0, removed: 0 });
	});

	it("drops entries for unknown and disabled rules", () => {
		const existing = [
			{ count: 1, file: "src/a.ts", rule: "local/typo" },
			{ count: 1, file: "src/a.ts", rule: "local/off" },
		];
		expect(prune(existing, [violation({ file: "src/a.ts", rule: "local/off" })], known).removed).toBe(2);
	});

	it("carries the entry of a moved file to its new path, lowered to what is left there", () => {
		const existing = [{ count: 350, file: "src/old.ts", rule: "structure/max-lines" }];
		const moved = violation({ count: 330, file: "lib/new.ts", rule: "structure/max-lines", threshold: 150 });
		expect(prune(existing, [moved], known, { moves: new Map([["src/old.ts", "lib/new.ts"]]) })).toEqual({
			entries: [{ count: 330, file: "lib/new.ts", rule: "structure/max-lines" }],
			lowered: 1,
			moved: 1,
			removed: 0,
		});
	});

	it("never carries an entry onto a path that already has one", () => {
		const existing = [
			{ count: 350, file: "src/old.ts", rule: "structure/max-lines" },
			{ count: 150, file: "lib/new.ts", rule: "structure/max-lines" },
		];
		const pruned = prune(existing, [violation({ count: 150, file: "lib/new.ts", rule: "structure/max-lines", threshold: 150 })], known, {
			moves: new Map([["src/old.ts", "lib/new.ts"]]),
		});
		expect(pruned.entries).toEqual([existing[1]]);
	});

	it("touches only the entries of the files in scope", () => {
		const existing = [
			{ count: 3, file: "src/a.ts", rule: "local/new" },
			{ count: 2, file: "src/gone.ts", rule: "local/new" },
		];
		const pruned = prune(existing, [fresh], known, { files: new Set(["src/a.ts"]), moves: new Map() });
		expect(pruned).toEqual({ entries: [{ count: 1, file: "src/a.ts", rule: "local/new" }, existing[1]], lowered: 1, moved: 0, removed: 0 });
	});
});
