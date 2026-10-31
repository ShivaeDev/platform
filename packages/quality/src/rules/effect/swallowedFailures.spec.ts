import { expect } from "vitest";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { failureHonesty } from "./failureHonesty.ts";

const EFFECT_IMPORT = 'import { Effect as E, FileSystem } from "effect";';

for (const { name, rejected, accepted, message } of [
	{
		accepted:
			'export const loop = E.forever(work.pipe(E.retry({ times: 3, schedule: spaced }), E.catchTag("Unavailable", reportUnavailable))).pipe(E.forkScoped);',
		message:
			"Forked forever loop dies on failure. Catch a named reason within each iteration with a Schedule-bounded retry, or expose an explicit unavailable state and supervise termination.",
		name: "a forked forever loop that dies",
		rejected: "export const loop = E.forever(work).pipe(E.orDie, E.forkScoped);",
	},
	{
		accepted: "export const read = work.pipe(E.retry({ while: isConflict, schedule: boundedSchedule }));",
		message: "Retry has while without times or schedule. Use a Schedule-bounded retry and preserve the final typed failure.",
		name: "an unbounded conditional retry",
		rejected: "export const read = work.pipe(E.retry({ while: isConflict }));",
	},
	{
		accepted: 'export const read = work.pipe(E.catchTag("Missing", () => E.succeed(false)));',
		message:
			"Catch turns every failure into success. Catch a named reason with catchTag or catchIf and re-fail the rest, or model an explicit unavailable state.",
		name: "a blanket catch returning success",
		rejected: "export const read = work.pipe(E.catch(() => E.succeed(false)));",
	},
	{
		accepted:
			'export const read = E.gen(function* () { const fs = yield* FileSystem.FileSystem; return yield* fs.readFileString("config").pipe(E.catchIf((error) => error.reason._tag === "NotFound", () => E.succeed(undefined))); });',
		message:
			"FileSystem failure becomes absence or success. Catch a named reason such as NotFound, re-fail other errors, or return an explicit unavailable state.",
		name: "a FileSystem failure returning absence",
		rejected:
			'export const read = E.gen(function* () { const fs = yield* FileSystem.FileSystem; return yield* fs.readFileString("config").pipe(E.option); });',
	},
]) {
	ruleStory.it(
		`effect/failure-honesty reports ${name} and accepts its typed alternative`,
		[repositoryHas({ content: `${EFFECT_IMPORT}\n${rejected}\n${accepted}`, path: "src/work.ts" })],
		function* ({ check }) {
			const findings = yield* check(failureHonesty);

			expect(findings).toEqual([{ file: "src/work.ts", line: 2, message }]);
		},
	);
}

ruleStory.it(
	"effect/failure-honesty follows local aliases, nested calls, catch branches and FileSystem recovery",
	[
		repositoryHas({
			content: [
				'import * as E from "effect/Effect";',
				'import * as FS from "effect/FileSystem";',
				"const recover = () => E.succeed([]);",
				"const retry = E.retry;",
				"export const one = E.forkScoped(E.orDie(E.forever(work)));",
				"export const two = work.pipe(retry({ while: isConflict }));",
				"export const three = E.catch(work, recover);",
				"export const four = work.pipe(E.catch((error) => { if (error.flag) return E.succeed(1); return E.succeed(2); }));",
				'export const five = E.gen(function* () { const fs = yield* FS.FileSystem; const files = fs; return yield* E.option(files.stat("config")); });',
				'export const six = E.gen(function* () { const fs = yield* FS.FileSystem; return yield* fs.readFileString("config").pipe(E.orElseSucceed(() => "")); });',
			].join("\n"),
			path: "src/adapters/work.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(failureHonesty);

		expect(findings.map(({ line }) => line)).toEqual([5, 6, 7, 8, 9, 10]);
	},
);

ruleStory.it(
	"effect/failure-honesty accepts bounded retries, re-failing branches and unrelated APIs",
	[
		repositoryHas({
			content: [
				EFFECT_IMPORT,
				"export const one = work.pipe(E.retry({ while: isConflict, times: 3 }));",
				'export const two = work.pipe(E.catch((error) => error.reason._tag === "NotFound" ? E.succeed(undefined) : E.fail(error)));',
				'export const three = work.pipe(E.catch((error) => { if (error.reason._tag === "NotFound") return E.void; return E.fail(error); }));',
				"export const four = E.option(E.currentSpan);",
				"const other = { catch: (f) => f(), retry: (x) => x };",
				"export const five = other.catch(() => E.succeed(false));",
				"export const six = other.retry({ while: isConflict });",
			].join("\n"),
			path: "src/work.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(failureHonesty);

		expect(findings).toEqual([]);
	},
);
