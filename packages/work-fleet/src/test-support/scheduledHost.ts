import { Context, Stream, SubscriptionRef } from "effect";
import { SchedulerPasses } from "#engine/health.ts";
import { host } from "#test/hostStory.ts";

export const scheduledHost = host.trait("configuration", "the daemon schedules approved work", (engine) => {
	engine.scheduled = true;
});

export const readyScheduledHost = host.traits(
	scheduledHost,
	host.trait("observation", "the daemon has finished its first scheduler pass", (engine) =>
		SubscriptionRef.changes(Context.get(engine.running.context, SchedulerPasses)).pipe(
			Stream.takeUntil((count) => count > 0),
			Stream.runDrain,
		),
	),
);

export const observedConnections = host.trait("configuration", "PostgreSQL reports the daemon's open sessions", (engine) => {
	engine.observeConnections = true;
});
