import { Effect, FileSystem, Option, Path, Ref, Semaphore } from "effect";
import { definesModule, readConfig } from "#adapters/typeScript.ts";
import { readIfPresent } from "#files.ts";
import { generate } from "#generate.ts";
import { listsSomething } from "#moduleList.ts";
import { projectFolder } from "#project.ts";
import { registrationPartsOf } from "#registrationParts.ts";
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
	const files = [...report.modules, ...report.lists];
	const round: GenerateRound = {
		changed: files.filter(({ status }) => status === "written" || status === "removed").map(({ output }) => path.join(root, output)),
		inputs: report.inputs,
		outputs: files.map(({ output }) => path.join(root, output)),
		refusal,
	};
	return round;
});

export const generateRound = Effect.fn("Build.generateRound")(function* (directory: string) {
	const root = yield* projectFolder(directory);
	return yield* generate(root, { check: false }).pipe(
		Effect.flatMap((report) => roundOf(root, report, Option.none())),
		Effect.catchTag("GenerateFailed", (failed) => roundOf(root, failed.report, Option.some(failed.problems.join("\n")))),
	);
});

// A dev server's generator: one run at a time, and a changed file starts a run only when the last run read it or it is a module
// file, a registration or a client module under src that no run has seen yet. Vite watches only its root, so a dev server
// whose root lies inside the project adds src to its watcher before the first run.
export const watchedGeneration = Effect.fn("Build.watchedGeneration")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* projectFolder(directory);
	const { names: parts } = yield* registrationPartsOf(yield* readConfig(path.join(root, "tsconfig.json")), root);
	const sources = `${path.join(root, "src")}${path.sep}`;
	const generated = `${path.join(sources, "generated")}${path.sep}`;
	const inputs = yield* Ref.make<ReadonlySet<string>>(new Set());
	const serial = yield* Semaphore.make(1);
	const run = serial.withPermits(1)(Effect.tap(generateRound(root), (round) => Ref.set(inputs, new Set(round.inputs))));
	const newModule = Effect.fn("Build.newModule")(function* (file: string) {
		if (!(file.startsWith(sources) && (file.endsWith(".ts") || file.endsWith(".tsx"))) || file.startsWith(generated)) {
			return false;
		}
		return Option.exists(yield* readIfPresent(file), (text) => definesModule(file, text) || listsSomething(path.relative(root, file), text, parts));
	});
	const changed = Effect.fn("Build.changed")(function* (file: string) {
		const real = yield* fs.realPath(file).pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(file)));
		const known = (yield* Ref.get(inputs)).has(real);
		return known || (yield* newModule(real)) ? Option.some(yield* run) : Option.none<GenerateRound>();
	});
	return { changed, run, sources: path.join(root, "src") };
});

export type WatchedGeneration = Effect.Success<ReturnType<typeof watchedGeneration>>;
