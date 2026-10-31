import { expect } from "vitest";
import { starterBaseline } from "#quality/starterBaseline.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

ruleKit.it(
	"the starter gate and root gate retain equal debt after paths are rebased",
	[
		repositoryHas(
			{ content: '{"path":"examples/starter/src/old.ts","rule":"effect/boundary","count":2}\n', path: "quality-baseline.jsonl" },
			{ content: '{"path":"src/old.ts","rule":"effect/boundary","count":2}\n', path: "examples/starter/quality-baseline.jsonl" },
		),
	],
	function* ({ checks, writes }) {
		expect(yield* checks(starterBaseline)).toEqual([]);

		yield* writes({ content: '{"path":"src/old.ts","rule":"effect/boundary","count":1}\n', path: "examples/starter/quality-baseline.jsonl" });

		expect(yield* checks(starterBaseline)).toEqual([
			{
				file: "quality-baseline.jsonl",
				message: "Keep starter entries equal to examples/starter/quality-baseline.jsonl, with the examples/starter/ prefix.",
			},
		]);
	},
);
