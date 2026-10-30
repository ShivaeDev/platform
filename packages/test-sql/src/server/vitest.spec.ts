import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRunner } from "#test/vitestRunner.ts";

vitestRunner.it(
	"the next rollback story starts without the harness, body and finalizer writes of the story before it",
	[],
	function* ({ runConsumerStories, consumerOutcomes, itemsSeen }) {
		yield* runConsumerStories();

		yield* outcomes({
			"the consumer's stories": [consumerOutcomes(), ["passed", "passed", "passed"]],
			"the first story's body saw": [itemsSeen("the first story", "body"), ["body", "harness"]],
			"the first story's harness saw": [itemsSeen("the first story", "harness"), ["seed"]],
			"the next story's body saw": [itemsSeen("the next story", "body"), ["seed", "harness"]],
			"the next story's harness saw": [itemsSeen("the next story", "harness"), ["seed"]],
		});
	},
	30_000,
);

vitestRunner.it(
	"an isolated block inside a rollback story runs without a transaction and commits where another connection sees it, outside the rollback story",
	[],
	function* ({ runConsumerStories, consumerOutcomes, isolatedBlockSaw, itemsSeen }) {
		yield* runConsumerStories();

		yield* outcomes({
			"another connection to the block's database": [isolatedBlockSaw("another connection"), ["committed"]],
			"the block's starting items": [isolatedBlockSaw("its starting items"), ["seed"]],
			"the block's transaction": [isolatedBlockSaw("a transaction"), "none"],
			"the consumer's stories": [consumerOutcomes(), ["passed", "passed", "passed"]],
			"the rollback story afterwards": [itemsSeen("the isolated story", "body"), ["seed", "harness"]],
		});
	},
	30_000,
);
