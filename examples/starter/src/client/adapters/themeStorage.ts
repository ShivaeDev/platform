import { Data, Effect } from "effect";

class StorageUnavailable extends Data.TaggedError("StorageUnavailable")<{ readonly cause: unknown }> {}

export const themeStorage = {
	read: () =>
		Effect.runSync(
			Effect.try({
				catch: (cause) => new StorageUnavailable({ cause }),
				try: () => localStorage.getItem("theme"),
			}).pipe(Effect.catchTag("StorageUnavailable", () => Effect.succeed(null))),
		),
	write: (theme: string) =>
		Effect.runSync(
			Effect.try({
				catch: (cause) => new StorageUnavailable({ cause }),
				try: () => localStorage.setItem("theme", theme),
			}).pipe(Effect.catchTag("StorageUnavailable", () => Effect.void)),
		),
};
