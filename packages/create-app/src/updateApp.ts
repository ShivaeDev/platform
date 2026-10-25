import { join, resolve } from "node:path";
import { Console, Effect, FileSystem, Schema } from "effect";
import { CreateAppError } from "./CreateAppError.ts";
import { GENERATION_FILE, Generation, readTemplate, writeGeneration } from "./generation.ts";
import { historicalTemplate } from "./historicalTemplate.ts";
import { checkedProcess, runProcess } from "./runProcess.ts";
import { starterPatch } from "./starterPatch.ts";

export const updateApp = Effect.fn("CreateApp.updateApp")(function* (folder: string, templatePath: string, version: string) {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const target = resolve(folder);
			yield* checkedProcess(target, "git", ["rev-parse", "--show-toplevel"]);
			if ((yield* checkedProcess(target, "git", ["status", "--porcelain"])).trim() !== "") {
				return yield* new CreateAppError({ message: "Refusing to update a dirty working tree. Commit or stash your changes first." });
			}
			const generation = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Generation))(
				yield* fs.readFileString(join(target, GENERATION_FILE)),
			);
			const directory = yield* fs.makeTempDirectoryScoped({ prefix: "create-app-update-" });
			const current = yield* readTemplate(templatePath);
			const previous = generation.version === version ? current : yield* historicalTemplate(directory, generation.version);
			const patch = yield* starterPatch(target, directory, generation.name, previous, current);
			if (!patch.empty) {
				const result = yield* runProcess(target, "git", ["apply", "--3way", patch.path]);
				if (result.code !== 0) {
					const conflicts = (yield* checkedProcess(target, "git", ["diff", "--name-only", "--diff-filter=U"])).trim();
					return yield* new CreateAppError({
						message: conflicts
							? `Resolve these conflicts, then commit your changes:\n${conflicts}\nThe recorded version remains ${generation.version}.`
							: result.stderr.trim(),
					});
				}
			}
			yield* writeGeneration(target, { ...generation, version });
			yield* Console.log(`Applied create-app ${version}. Review the changes, run pnpm install and commit when ready.`);
		}),
	);
});
