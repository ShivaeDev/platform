import { join } from "node:path";
import { Console, Effect, type FileSystem } from "effect";
import type { BaselineEntry } from "../baseline/format.ts";
import { rewriteBaseline } from "../baseline/rewrite.ts";
import { adopt, type Pruned, prune, type Scope } from "../baseline/update.ts";
import { openSession, type Session } from "../engine/session.ts";
import { applyRegistry } from "../exceptions/registry.ts";
import { SetupFailure } from "../failure.ts";
import { writeText } from "../inventory/filesystem.ts";
import { plural } from "../report/plural.ts";

const save = (session: Session, entries: ReadonlyArray<BaselineEntry>): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> =>
	Effect.mapError(
		writeText(join(session.config.root, session.config.baseline), rewriteBaseline(session.baseline.raw, session.baseline.entries, entries)),
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
		if (adoption.added === 0 && adoption.replaced === 0) {
			return yield* Console.log(`quality: no error-level violations to record; ${session.config.baseline} is unchanged.`);
		}
		yield* save(session, adoption.entries);
		const replaced = adoption.replaced > 0 ? `, replacing ${plural(adoption.replaced, "entry", "entries")}` : "";
		yield* Console.log(`quality: recorded ${plural(adoption.added, "entry", "entries")} in ${session.config.baseline}${replaced}.`);
	});

const changes = (pruned: Pruned): string => {
	const parts = [
		`removed ${plural(pruned.removed, "entry", "entries")}`,
		`lowered ${plural(pruned.lowered, "entry", "entries")}`,
		...(pruned.moved > 0 ? [`carried ${plural(pruned.moved, "entry", "entries")} to moved files`] : []),
	];
	return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
};

export const shrinkBaseline = <Requirements>(
	cwd: string,
	config: string | undefined,
	scopeOf: (session: Session) => Effect.Effect<Scope, SetupFailure, Requirements>,
): Effect.Effect<void, SetupFailure, FileSystem.FileSystem | Requirements> =>
	Effect.gen(function* () {
		const session = yield* openSession(cwd, config);
		if (session.baseline.raw === undefined) {
			return yield* Console.log(`quality: no baseline at ${session.config.baseline}; nothing to lower.`);
		}
		const pruned = prune(session.baseline.entries, unregistered(session), session.config.levels, yield* scopeOf(session));
		if (pruned.removed === 0 && pruned.lowered === 0 && pruned.moved === 0) {
			return yield* Console.log(`quality: ${session.config.baseline} is current.`);
		}
		yield* save(session, pruned.entries);
		yield* Console.log(`quality: ${changes(pruned)} in ${session.config.baseline}.`);
	});
