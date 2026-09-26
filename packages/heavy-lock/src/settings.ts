import { Config, Effect, Option, Path } from "effect";
import { HeavyLockError } from "./error.ts";
import { HOLDER_ID_ENV } from "./holder.ts";

const Environment = Config.all({
	lock: Config.option(Config.nonEmptyString("HEAVY_PROCESS_LOCK")),
	home: Config.option(Config.nonEmptyString("HOME")),
	ci: Config.string("CI").pipe(Config.withDefault("")),
	inherited: Config.option(Config.nonEmptyString(HOLDER_ID_ENV)),
});

export interface Settings {
	readonly lock: string;
	readonly ci: boolean;
	readonly inherited: Option.Option<string>;
}

export const readSettings = Effect.fn("HeavyLock.readSettings")(function* (lockPath: string | undefined) {
	const environment = yield* Environment.pipe(
		Effect.mapError((cause) => new HeavyLockError({ message: "Could not read the heavy-lock environment.", cause })),
	);
	const path = yield* Path.Path;
	const home = Option.map(environment.home, (home) => path.join(home, ".cache", "heavy-process.lock"));
	const lock = Option.firstSomeOf([Option.fromUndefinedOr(lockPath), environment.lock, home]);
	if (Option.isNone(lock)) {
		return yield* new HeavyLockError({ message: "Set HOME or HEAVY_PROCESS_LOCK to locate the lock file." });
	}
	return { lock: lock.value, ci: environment.ci !== "", inherited: environment.inherited } satisfies Settings;
});
