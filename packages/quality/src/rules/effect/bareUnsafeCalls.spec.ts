import { unsafeCalls } from "#rules/effect/unsafeCalls.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { uncheckedPaths, unsafeAccepted, unsafeRejected } from "#test/unsafeCallFiles.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const { code, message, name } of unsafeRejected) {
	ruleStory.it(
		`effect/unsafe-calls reports ${name} with its safe counterpart`,
		[repositoryHas({ content: code, path: "src/clock.ts" })],
		function* ({ check, messages }) {
			yield* check(unsafeCalls);

			yield* assertThat(yield* messages(), (actual) => actual.toEqual([message]));
		},
	);
}

for (const { code, name } of unsafeAccepted) {
	ruleStory.it(`effect/unsafe-calls accepts ${name}`, [repositoryHas({ content: code, path: "src/clock.ts" })], function* ({ check, findings }) {
		yield* check(unsafeCalls);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	});
}

ruleStory.it(
	"effect/unsafe-calls leaves adapters, test-support, tests and tool configs unchecked",
	[repositoryHas(...uncheckedPaths)],
	function* ({ check, findings }) {
		yield* check(unsafeCalls);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"effect/unsafe-calls reports a call at its line",
	[
		repositoryHas({
			content:
				'import { Effect, Queue } from "effect";\n\nexport const offer = (queue: Queue.Queue<number>) => {\n\tQueue.offerUnsafe(queue, 1);\n};\n',
			path: "src/offer.ts",
		}),
	],
	function* ({ check, locations }) {
		yield* check(unsafeCalls);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/offer.ts:4"]));
	},
);
