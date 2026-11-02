import { join, relative, resolve } from "node:path";
import { Console, Effect, FileSystem, Schema } from "effect";
import { CreateAppError } from "#CreateAppError.ts";
import { GENERATION_FILE, Generation, readTemplate, writeGeneration } from "#generation.ts";
import { historicalTemplate } from "#historicalTemplate.ts";
import { checkedProcess, runProcess } from "#runProcess.ts";
import { starterPatch } from "#starterPatch.ts";
import { appTemplate } from "#template.ts";
import { updateChecks } from "#updateChecks.ts";

const applyPatch = Effect.fn("CreateApp.applyPatch")(function* (
	target: string,
	repository: string,
	patch: Effect.Success<ReturnType<typeof starterPatch>>,
) {
	const prefix = relative(repository, target);
	if (!patch.empty) {
		const result = yield* runProcess(repository, "git", ["apply", "--3way", ...(prefix ? [`--directory=${prefix}`] : []), patch.path]);
		if (result.code !== 0) {
			const conflicts = (yield* checkedProcess(target, "git", ["diff", "--name-only", "--diff-filter=U", "--", "."])).trim();
			if (!conflicts) {
				return yield* new CreateAppError({ message: result.stderr.trim() });
			}
		}
	}
	if (patch.conflicts.length > 0) {
		yield* checkedProcess(repository, "git", ["update-index", "-z", "--index-info"], patch.conflicts.map((conflict) => conflict.indexInfo).join(""));
	}
	if ((yield* checkedProcess(target, "git", ["diff", "--cached", "--name-only", "--", "."])).trim() === "") {
		return yield* new CreateAppError({ message: "The starter delta applied no changes. The generation record is unchanged." });
	}
});

export const updateApp = Effect.fn("CreateApp.updateApp")(function* (folder: string, templatePath: string, version: string) {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const target = resolve(folder);
			const repository = (yield* checkedProcess(target, "git", ["rev-parse", "--show-toplevel"])).trim();
			if ((yield* checkedProcess(target, "git", ["status", "--porcelain", "--", "."])).trim() !== "") {
				return yield* new CreateAppError({ message: "Refusing to update a dirty working tree. Commit or stash your changes first." });
			}
			const generation = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Generation))(
				yield* fs.readFileString(join(target, GENERATION_FILE)),
			);
			const directory = yield* fs.makeTempDirectoryScoped({ prefix: "create-app-update-" });
			const current = yield* readTemplate(templatePath);
			const previous = generation.version === version ? current : yield* historicalTemplate(directory, generation.version);
			const patch = yield* starterPatch(
				target,
				directory,
				generation.name,
				appTemplate(previous, generation.minimal),
				appTemplate(current, generation.minimal),
			);
			if (!patch.empty || patch.conflicts.length > 0) {
				yield* applyPatch(target, repository, patch);
			}
			yield* writeGeneration(target, { ...generation, version });
			const failures = yield* updateChecks(target);
			if (patch.conflicts.length > 0) {
				failures.push(
					`Starter deletions conflict with app changes:\n${patch.conflicts.map((conflict) => conflict.path).join("\n")}\nKeep a file with git add -- <path>, or accept its deletion with git rm -- <path>.`,
				);
			}
			if (failures.length > 0) {
				return yield* new CreateAppError({
					message: `Recorded create-app ${version}. Finish the update before committing:\n${failures.join("\n\n")}`,
				});
			}
			yield* Console.log(`Applied create-app ${version}. Install and typecheck passed. Review the changes and commit when ready.`);
		}),
	);
});
