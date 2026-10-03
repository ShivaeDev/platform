import { Config, Effect, Option, Path } from "effect";
import { HeavyLockError } from "./error.ts";
import { HOLDER_ID_ENV } from "./holder.ts";

const Environment = Config.all({
	ci: Config.string("CI").pipe(Config.withDefault("")),
	home: Config.option(Config.nonEmptyString("HOME")),
	inherited: Config.option(Config.nonEmptyString(HOLDER_ID_ENV)),
	lock: Config.option(Config.nonEmptyString("HEAVY_PROCESS_LOCK")),
});

export interface Settings {
	readonly ci: boolean;
	readonly inherited: Option.Option<string>;
	readonly lock: string;
}

export const readSettings = Effect.fn("HeavyLock.readSettings")(function* (lockPath: string | undefined) {
	const environment = yield* Environment.pipe(
		Effect.mapError((cause) => new HeavyLockError({ cause, message: "Could not read the heavy-lock environment." })),
	);
	const path = yield* Path.Path;
	const home = Option.map(environment.home, (home) => path.join(home, ".cache", "heavy-process.lock"));
	const lock = Option.firstSomeOf([Option.fromUndefinedOr(lockPath), environment.lock, home]);
	if (Option.isNone(lock)) {
		return yield* new HeavyLockError({ message: "Set HOME or HEAVY_PROCESS_LOCK to locate the lock file." });
	}
	return { ci: environment.ci !== "", inherited: environment.inherited, lock: lock.value } satisfies Settings;
});
