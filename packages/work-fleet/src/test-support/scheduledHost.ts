import { schedulerReady } from "#test/approvedPrDaemon.ts";
import { host } from "#test/hostStory.ts";

export const scheduledHost = host.trait("configuration", "the daemon schedules approved work", (engine) => {
	engine.scheduled = true;
});

export const readyScheduledHost = host.traits(
	scheduledHost,
	host.trait("observation", "the daemon has finished its first scheduler pass", (engine) => schedulerReady(engine.fixture.host.boardDir, null)),
);

export const observedConnections = host.trait("configuration", "PostgreSQL reports the daemon's open sessions", (engine) => {
	engine.observeConnections = true;
});
