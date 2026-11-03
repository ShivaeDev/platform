import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { adopt, prune } from "#baseline/update.ts";
import { levels, violation } from "#test/violations.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const known = levels({ "local/new": "error", "structure/max-lines": "error" });
const long = violation({ count: 262, file: "src/big.ts", rule: "structure/max-lines", threshold: 150 });
const fresh = violation({ file: "src/a.ts", rule: "local/new" });

describe("adopt", () => {
	it.effect("records every error-level violation when no baseline exists", function* () {
		yield* assertThat(adopt(undefined, [], [long, fresh, fresh], known), (actual) =>
			actual.toEqual({
				_tag: "Adopted",
				added: 2,
				entries: [
					{ count: 262, file: "src/big.ts", rule: "structure/max-lines" },
					{ count: 2, file: "src/a.ts", rule: "local/new" },
				],
				replaced: 0,
			}),
		);
	});

	it.effect("adopts a named rule into an existing baseline and leaves other entries alone", function* () {
		const existing = [{ count: 250, file: "src/big.ts", rule: "structure/max-lines" }];
		const adoption = adopt(existing, ["local/new"], [long, fresh], known);
		yield* assertThat(adoption, (actual) =>
			actual.toEqual({ _tag: "Adopted", added: 1, entries: [...existing, { count: 1, file: "src/a.ts", rule: "local/new" }], replaced: 0 }),
		);
	});

	it.effect("records a rule it already covers again, replacing its entries", function* () {
		const existing = [
			{ count: 12, file: "src/big.ts", rule: "structure/max-lines" },
			{ count: 5, file: "src/gone.ts", rule: "structure/max-lines" },
			{ count: 2, file: "src/a.ts", rule: "local/new" },
		];
		yield* assertThat(adopt(existing, ["structure/max-lines"], [long, fresh], known), (actual) =>
			actual.toEqual({
				_tag: "Adopted",
				added: 1,
				entries: [existing[2], { count: 262, file: "src/big.ts", rule: "structure/max-lines" }],
				replaced: 2,
			}),
		);
	});

	it.effect("adopts and replaces every rule of a family through the family's name", function* () {
		const family = levels({ tool: "error" }, { families: ["tool"] });
		const eqeq = violation({ file: "src/a.ts", rule: "tool/lint/eqeq" });
		const existing = [
			{ count: 4, file: "src/gone.ts", rule: "tool/format" },
			{ count: 250, file: "src/big.ts", rule: "structure/max-lines" },
		];
		yield* assertThat(adopt(existing, ["tool"], [eqeq], family), (actual) =>
			actual.toEqual({
				_tag: "Adopted",
				added: 1,
				entries: [existing[1], { count: 1, file: "src/a.ts", rule: "tool/lint/eqeq" }],
				replaced: 1,
			}),
		);
	});

	it.effect("never records a finding that counts no violations", function* () {
		const within = violation({ count: 0, file: "src/a.ts", rule: "local/new" });
		yield* assertThat(adopt(undefined, [], [within], known), (actual) => actual.toEqual({ _tag: "Adopted", added: 0, entries: [], replaced: 0 }));
	});

	it.effect("refuses an unknown rule", function* () {
		const adoption = adopt([{ count: 1, file: "src/big.ts", rule: "structure/max-lines" }], ["local/typo"], [long, fresh], known);
		yield* assertThat(adoption, (actual, expect) =>
			actual.toEqual({ _tag: "Refused", reasons: [expect.stringContaining("no built-in or local rule")] }),
		);
	});
});

describe("prune", () => {
	it.effect("keeps the reason when moved debt is lowered", function* () {
		const reason = "The row schema must come from its caller.";
		const result = prune(
			[{ count: 2, file: "src/before.ts", reason, rule: "local/new" }],
			[violation({ file: "src/after.ts", rule: "local/new" })],
			known,
			{ moves: new Map([["src/before.ts", "src/after.ts"]]) },
		);

		yield* assertThat(result.entries, (actual) => actual.toEqual([{ count: 1, file: "src/after.ts", reason, rule: "local/new" }]));
	});

	it.effect("drops fixed debt and lowers what shrank", function* () {
		const pruned = prune(
			[
				{ count: 1, file: "src/gone.ts", rule: "local/new" },
				{ count: 3, file: "src/a.ts", rule: "local/new" },
				{ count: 350, file: "src/big.ts", rule: "structure/max-lines" },
			],
			[fresh, long],
			known,
		);
		yield* assertThat(pruned, (actual) =>
			actual.toEqual({
				entries: [
					{ count: 1, file: "src/a.ts", rule: "local/new" },
					{ count: 262, file: "src/big.ts", rule: "structure/max-lines" },
				],
				lowered: 2,
				moved: 0,
				removed: 1,
			}),
		);
	});

	it.effect("never raises an entry for a file that got worse", function* () {
		const existing = [{ count: 150, file: "src/big.ts", rule: "structure/max-lines" }];
		yield* assertThat(prune(existing, [long], known), (actual) => actual.toEqual({ entries: existing, lowered: 0, moved: 0, removed: 0 }));
	});

	it.effect("drops entries for unknown rules", function* () {
		const existing = [{ count: 1, file: "src/a.ts", rule: "local/typo" }];
		yield* assertThat(prune(existing, [violation({ file: "src/a.ts", rule: "local/typo" })], known), (actual) =>
			actual.toEqual({ entries: [], lowered: 0, moved: 0, removed: 1 }),
		);
	});

	it.effect("carries the entry of a moved file to its new path, lowered to what is left there", function* () {
		const existing = [{ count: 350, file: "src/old.ts", rule: "structure/max-lines" }];
		const moved = violation({ count: 330, file: "lib/new.ts", rule: "structure/max-lines", threshold: 150 });
		yield* assertThat(prune(existing, [moved], known, { moves: new Map([["src/old.ts", "lib/new.ts"]]) }), (actual) =>
			actual.toEqual({
				entries: [{ count: 330, file: "lib/new.ts", rule: "structure/max-lines" }],
				lowered: 1,
				moved: 1,
				removed: 0,
			}),
		);
	});

	it.effect("never carries an entry onto a path that already has one", function* () {
		const existing = [
			{ count: 350, file: "src/old.ts", rule: "structure/max-lines" },
			{ count: 150, file: "lib/new.ts", rule: "structure/max-lines" },
		];
		const pruned = prune(existing, [violation({ count: 150, file: "lib/new.ts", rule: "structure/max-lines", threshold: 150 })], known, {
			moves: new Map([["src/old.ts", "lib/new.ts"]]),
		});
		yield* assertThat(pruned.entries, (actual) => actual.toEqual([existing[1]]));
	});

	it.effect("touches only the entries of the files in scope", function* () {
		const existing = [
			{ count: 3, file: "src/a.ts", rule: "local/new" },
			{ count: 2, file: "src/gone.ts", rule: "local/new" },
		];
		const pruned = prune(existing, [fresh], known, { files: new Set(["src/a.ts"]), moves: new Map() });
		yield* assertThat(pruned, (actual) =>
			actual.toEqual({ entries: [{ count: 1, file: "src/a.ts", rule: "local/new" }, existing[1]], lowered: 1, moved: 0, removed: 0 }),
		);
	});
});
