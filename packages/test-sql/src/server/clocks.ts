import { Clock, Context, type Duration, Effect } from "effect";

export const CleanupClock = Context.Reference<Clock.Clock>("@shivaedev/test-sql/CleanupClock", {
	defaultValue: () => Clock.Clock.defaultValue(),
});

interface CatalogTiming {
	readonly deadline: (duration: Duration.Input) => Effect.Effect<void>;
	readonly pause: (duration: Duration.Input) => Effect.Effect<void>;
}

export const CatalogClock = Context.Reference<CatalogTiming>("@shivaedev/test-sql/CatalogClock", {
	defaultValue: () => {
		function sleep(duration: Duration.Input) {
			return Effect.sleep(duration).pipe(Effect.provideService(Clock.Clock, Clock.Clock.defaultValue()));
		}
		return { deadline: sleep, pause: sleep };
	},
});
