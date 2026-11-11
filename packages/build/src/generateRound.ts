import { Effect, FileSystem, Option, Path, Ref, Semaphore } from "effect";
import { definesModule } from "#adapters/typeScript.ts";
import { readIfPresent } from "#files.ts";
import { generate } from "#generate.ts";
import type { GenerateReport } from "#report.ts";

export interface GenerateRound {
	readonly changed: readonly string[];
	readonly inputs: readonly string[];
	readonly outputs: readonly string[];
	// The generator's message when it refused a module; the refused module's file is left as it was.
	readonly refusal: Option.Option<string>;
}

const roundOf = Effect.fn("Build.roundOf")(function* (root: string, report: GenerateReport, refusal: Option.Option<string>) {
	const path = yield* Path.Path;
	const round: GenerateRound = {
		changed: report.modules.filter(({ status }) => status === "written" || status === "removed").map(({ output }) => path.join(root, output)),
		inputs: report.inputs,
		outputs: report.modules.map(({ output }) => path.join(root, output)),
		refusal,
	};
	return round;
});

export const generateRound = Effect.fn("Build.generateRound")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.realPath(directory);
	return yield* generate(root, { check: false }).pipe(
		Effect.flatMap((report) => roundOf(root, report, Option.none())),
		Effect.catchTag("GenerateFailed", (failed) => roundOf(root, failed.report, Option.some(failed.problems.join("\n")))),
	);
});

// A dev server's generator: one run at a time, and a changed file starts a run only when some module's last run read it or it
// is a module file under src that no run has seen yet.
export const watchedGeneration = Effect.fn("Build.watchedGeneration")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.realPath(directory);
	const sources = `${path.join(root, "src")}${path.sep}`;
	const generated = `${path.join(sources, "generated")}${path.sep}`;
	const inputs = yield* Ref.make<ReadonlySet<string>>(new Set());
	const serial = yield* Semaphore.make(1);
	const run = serial.withPermits(1)(Effect.tap(generateRound(root), (round) => Ref.set(inputs, new Set(round.inputs))));
	const newModule = Effect.fn("Build.newModule")(function* (file: string) {
		if (!file.startsWith(sources) || file.startsWith(generated)) {
			return false;
		}
		return Option.exists(yield* readIfPresent(file), (text) => definesModule(file, text));
	});
	const changed = Effect.fn("Build.changed")(function* (file: string) {
		const real = yield* fs.realPath(file).pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(file)));
		const known = (yield* Ref.get(inputs)).has(real);
		return known || (yield* newModule(real)) ? Option.some(yield* run) : Option.none<GenerateRound>();
	});
	return { changed, run };
});

export type WatchedGeneration = Effect.Success<ReturnType<typeof watchedGeneration>>;
