import { failureHonesty } from "#rules/effect/failureHonesty.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const INTERPOLATED = ["Effect.succeed(`failed with ${", "failureOf(error)}`)"].join("");

const TRANSLATIONS = [
	'import { Effect } from "effect";',
	"declare const work: Effect.Effect<string, Error>;",
	"const failureOf = (error: unknown) => String(error);",
	"export const direct = Effect.catch(work, (error) => Effect.succeed(failureOf(error)));",
	`export const piped = work.pipe(Effect.catch((error) => ${INTERPOLATED}));`,
	'export const tagged = work.pipe(Effect.catch((error) => Effect.succeed(error.name === "Unavailable" ? "unavailable" : "refused")));',
].join("\n");

ruleStory.it(
	"effect/failure-honesty accepts a test-support catch whose handler derives its value from the caught error",
	[repositoryHas({ content: TRANSLATIONS, path: "packages/kit/src/test-support/readouts.ts" })],
	function* ({ check }) {
		yield* assertThat(yield* check(failureHonesty), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"effect/failure-honesty reports the same translation outside test-support",
	[repositoryHas({ content: TRANSLATIONS, path: "packages/kit/src/readouts.ts" })],
	function* ({ check, locations }) {
		yield* check(failureHonesty);

		yield* assertThat(yield* locations(), (actual) =>
			actual.toEqual(["packages/kit/src/readouts.ts:4", "packages/kit/src/readouts.ts:5", "packages/kit/src/readouts.ts:6"]),
		);
	},
);

ruleStory.it(
	"effect/failure-honesty reports a test-support catch that ignores its error on any branch or catches the whole cause",
	[
		repositoryHas({
			content: [
				'import { Effect } from "effect";',
				"declare const work: Effect.Effect<string, Error>;",
				'export const ignores = work.pipe(Effect.catch(() => Effect.succeed("connection failed")));',
				'export const unused = work.pipe(Effect.catch((error) => Effect.succeed("unrecognized failure")));',
				'export const branch = work.pipe(Effect.catch((error) => error.name === "A" ? Effect.succeed(error.name) : Effect.succeed("other")));',
				"export const cause = work.pipe(Effect.catchCause((failure) => Effect.succeed(String(failure))));",
			].join("\n"),
			path: "packages/kit/src/test-support/readouts.ts",
		}),
	],
	function* ({ check, locations }) {
		yield* check(failureHonesty);

		yield* assertThat(yield* locations(), (actual) =>
			actual.toEqual([3, 4, 5, 6].map((line) => `packages/kit/src/test-support/readouts.ts:${line}`)),
		);
	},
);
