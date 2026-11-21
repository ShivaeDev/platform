import { dirname, join, resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import { orWhenAbsent } from "#inventory/filesystem.ts";
import type { RuleInputs } from "#rule.ts";

export const agentLinkFindings = Effect.fn("Quality.agentLinkFindings")(function* ({ files, root }: RuleInputs) {
	const fs = yield* FileSystem.FileSystem;
	const claudeFindings = yield* Effect.forEach(
		files.filter((file) => file === "CLAUDE.md" || file.endsWith("/CLAUDE.md")),
		(file) =>
			Effect.gen(function* () {
				const path = join(root, file);
				const info = yield* fs.lstat(path);
				const target = info.type === "SymbolicLink" ? yield* fs.readLink(path) : undefined;
				const agents = join(dirname(path), "AGENTS.md");
				const sibling = yield* orWhenAbsent<FileSystem.File.Info | undefined>(agents, fs.stat(agents), undefined);
				return target !== undefined && resolve(dirname(path), target) === agents && sibling?.type === "File"
					? []
					: [{ file, message: "Replace CLAUDE.md with a symlink to the AGENTS.md file beside it, and keep the instructions in AGENTS.md." }];
			}),
	);
	const agentsFindings = yield* Effect.forEach(
		files.filter((file) => file === "AGENTS.md" || file.endsWith("/AGENTS.md")),
		(file) =>
			Effect.gen(function* () {
				const agents = join(root, file);
				const claude = join(dirname(agents), "CLAUDE.md");
				const sibling = yield* orWhenAbsent<FileSystem.File.Info | undefined>(claude, fs.lstat(claude), undefined);
				return sibling === undefined ? [{ file, message: "Run `ln -s AGENTS.md CLAUDE.md` beside AGENTS.md." }] : [];
			}),
	);
	return [...claudeFindings, ...agentsFindings].flat();
});
