import { Console, Effect, type FileSystem } from "effect";
import type { BaselineEntry } from "#baseline/format.ts";
import { saveShards } from "#baseline/shards.ts";
import { adopt, type Pruned, prune, type Scope } from "#baseline/update.ts";
import { openSession, type Session } from "#engine/session.ts";
import { applyRegistry } from "#exceptions/registry.ts";
import { SetupFailure } from "#failure.ts";
import { plural } from "#report/plural.ts";

function save(session: Session, entries: readonly BaselineEntry[]): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> {
	return saveShards(session.config, session.baseline.files, entries);
}

function unregistered(session: Session) {
	return applyRegistry(session.violations, session.registry, session.config).kept;
}

export const writeBaseline = Effect.fn("Cli.writeBaseline")(function* (
	cwd: string,
	config: string | undefined,
	rules: readonly string[],
): Effect.fn.Return<void, SetupFailure, FileSystem.FileSystem> {
	const session = yield* openSession(cwd, config);
	const existing = session.baseline.files.size === 0 ? undefined : session.baseline.entries;
	const adoption = adopt(existing, rules, unregistered(session), session.config);
	if (adoption._tag === "Refused") {
		return yield* new SetupFailure({ message: `baseline write refused:\n${adoption.reasons.map((reason) => `  - ${reason}`).join("\n")}` });
	}
	if (adoption.added === 0 && adoption.replaced === 0) {
		return yield* Console.log(`quality: no error-level violations to record; ${session.config.baseline} is unchanged.`);
	}
	yield* save(session, adoption.entries);
	const replaced = adoption.replaced > 0 ? `, replacing ${plural(adoption.replaced, "entry", "entries")}` : "";
	yield* Console.log(`quality: recorded ${plural(adoption.added, "entry", "entries")} in ${session.config.baseline}${replaced}.`);
});

function changes(pruned: Pruned): string {
	const parts = [
		`removed ${plural(pruned.removed, "entry", "entries")}`,
		`lowered ${plural(pruned.lowered, "entry", "entries")}`,
		...(pruned.moved > 0 ? [`carried ${plural(pruned.moved, "entry", "entries")} to moved files`] : []),
	];
	return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export const shrinkBaseline = Effect.fn("Cli.shrinkBaseline")(function* <TRequirements>(
	cwd: string,
	config: string | undefined,
	scopeOf: (session: Session) => Effect.Effect<Scope, SetupFailure, TRequirements>,
): Effect.fn.Return<void, SetupFailure, FileSystem.FileSystem | TRequirements> {
	const session = yield* openSession(cwd, config);
	if (session.baseline.files.size === 0) {
		return yield* Console.log(`quality: no baseline at ${session.config.baseline}; nothing to lower.`);
	}
	const pruned = prune(session.baseline.entries, unregistered(session), session.config, yield* scopeOf(session));
	const emptyShard = [...session.baseline.files.values()].some((file) => file.entries.length === 0);
	if (pruned.removed === 0 && pruned.lowered === 0 && pruned.moved === 0 && !emptyShard) {
		return yield* Console.log(`quality: ${session.config.baseline} is current.`);
	}
	yield* save(session, pruned.entries);
	yield* Console.log(`quality: ${changes(pruned)} in ${session.config.baseline}.`);
});
