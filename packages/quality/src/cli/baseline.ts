import { join } from "node:path";
import { Console, Effect, type FileSystem } from "effect";
import { type BaselineEntry, encodeBaseline, indentOf } from "../baseline/format.ts";
import { adopt, prune } from "../baseline/update.ts";
import { openSession, type Session } from "../engine/session.ts";
import { applyRegistry } from "../exceptions/registry.ts";
import { SetupFailure } from "../failure.ts";
import { writeText } from "../inventory/filesystem.ts";
import { plural } from "../report/plural.ts";

const save = (session: Session, entries: ReadonlyArray<BaselineEntry>): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> =>
	Effect.mapError(
		writeText(join(session.config.root, session.config.baseline), encodeBaseline(entries, indentOf(session.baseline.raw))),
		(failure) => new SetupFailure({ message: failure.message }),
	);

const unregistered = (session: Session) =>
	applyRegistry(session.violations, session.registry, session.config.levels, session.config.unregistrable).kept;

export const writeBaseline = (
	cwd: string,
	config: string | undefined,
	rules: ReadonlyArray<string>,
): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const session = yield* openSession(cwd, config);
		const existing = session.baseline.raw === undefined ? undefined : session.baseline.entries;
		const adoption = adopt(existing, rules, unregistered(session), session.config.levels);
		if (adoption._tag === "Refused") {
			return yield* new SetupFailure({ message: `baseline write refused:\n${adoption.reasons.map((reason) => `  - ${reason}`).join("\n")}` });
		}
		if (adoption.added === 0) {
			return yield* Console.log(`quality: no error-level violations to record; ${session.config.baseline} is unchanged.`);
		}
		yield* save(session, adoption.entries);
		yield* Console.log(`quality: recorded ${plural(adoption.added, "entry", "entries")} in ${session.config.baseline}.`);
	});

export const pruneBaseline = (cwd: string, config: string | undefined): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const session = yield* openSession(cwd, config);
		if (session.baseline.raw === undefined) {
			return yield* Console.log(`quality: no baseline at ${session.config.baseline}; nothing to prune.`);
		}
		const pruned = prune(session.baseline.entries, unregistered(session), session.config.levels);
		if (pruned.removed === 0 && pruned.lowered === 0) {
			return yield* Console.log(`quality: ${session.config.baseline} is current.`);
		}
		yield* save(session, pruned.entries);
		yield* Console.log(
			`quality: removed ${plural(pruned.removed, "entry", "entries")} and lowered ${plural(pruned.lowered, "entry", "entries")} in ${session.config.baseline}.`,
		);
	});
