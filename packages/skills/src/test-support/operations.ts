import { Console, Effect, type FileSystem, type Path } from "effect";
import { checkSkills } from "#checkSkills.ts";
import { syncSkills } from "#syncSkills.ts";
import type { Fixture } from "./fixture.ts";

export const printedOrFailed = Effect.fn("SkillsStory.printedOrFailed")(function* (
	repo: string,
	operation: Effect.Effect<void, { readonly message: string }, FileSystem.FileSystem | Path.Path>,
) {
	const console = yield* Console.Console;
	const printed: string[] = [];
	const captured: Console.Console = {
		...console,
		log: (...parts) => {
			printed.push(parts.join(" "));
		},
	};
	return yield* operation.pipe(
		Effect.provideService(Console.Console, captured),
		Effect.match({
			onFailure: (error) => `failed: ${error.message.replaceAll(repo, "<repository>")}`,
			onSuccess: () => printed.join("\n"),
		}),
	);
});

function causeDetails(error: Error | undefined, repo: string) {
	const cause = error?.cause;
	if (!(cause instanceof Error)) {
		return undefined;
	}
	return {
		enumerable: Object.prototype.propertyIsEnumerable.call(error, "cause"),
		message: cause.message.replaceAll(repo, "<repository>"),
	};
}

export function operations(engine: Fixture, tell: (line: string) => void) {
	let failure: Error | undefined;
	function run(operation: Effect.Effect<void, Error, FileSystem.FileSystem | Path.Path>) {
		return printedOrFailed(
			engine.repo,
			operation.pipe(
				Effect.tapError((error) =>
					Effect.sync(() => {
						failure = error;
					}),
				),
			),
		);
	}
	return {
		check: () => {
			tell("the repository checks its shared skills");
			return run(checkSkills(engine.repo, engine.installed));
		},
		failureDetails: () =>
			Effect.sync(() => ({
				cause: causeDetails(failure, engine.repo),
				message: failure?.message.replaceAll(engine.repo, "<repository>"),
			})),
		sync: () => {
			tell("the repository syncs its selection");
			return run(syncSkills(engine.repo, engine.installed));
		},
	};
}
