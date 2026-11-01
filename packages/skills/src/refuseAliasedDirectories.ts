import { Effect, FileSystem, Option, Path } from "effect";
import { AGENTS_SKILLS, CLAUDE_SKILLS } from "./layout.ts";
import { SkillsError } from "./SkillsError.ts";

const resolvedDirectory = Effect.fn("Skills.resolvedDirectory")(function* (directory: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const missing: string[] = [];
	let current = directory;
	while (true) {
		const resolved = yield* fs.realPath(current).pipe(
			Effect.map(Option.some),
			Effect.catchIf(
				(error) => error.reason._tag === "NotFound",
				() => Effect.succeed(Option.none()),
			),
		);
		if (Option.isSome(resolved)) {
			return path.join(resolved.value, ...missing.reverse());
		}
		const isLink = yield* fs.lstat(current).pipe(
			Effect.map((info) => info.type === "SymbolicLink"),
			Effect.catchIf(
				(error) => error.reason._tag === "NotFound",
				() => Effect.succeed(false),
			),
		);
		if (isLink) {
			current = path.resolve(path.dirname(current), yield* fs.readLink(current));
			continue;
		}
		missing.push(path.basename(current));
		current = path.dirname(current);
	}
});

export const refuseAliasedDirectories = Effect.fn("Skills.refuseAliasedDirectories")(function* (repo: string) {
	const path = yield* Path.Path;
	const copies = yield* resolvedDirectory(path.resolve(repo, AGENTS_SKILLS));
	const links = yield* resolvedDirectory(path.resolve(repo, CLAUDE_SKILLS));
	if (copies === links) {
		return yield* new SkillsError({
			message: `${AGENTS_SKILLS} and ${CLAUDE_SKILLS} resolve to the same directory. Use separate directories, then sync again.`,
		});
	}
});
