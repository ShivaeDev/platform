import { Effect, Layer } from "effect";
import { unchanged } from "#host/mainSource.ts";
import { FleetPolicy } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { host } from "#test/hostStory.ts";
import { MAIN } from "#test/mainSource.ts";
import { stalledTransport } from "#test/parkStalled.ts";

export const noChangeHost = host.trait("configuration", "workers report no change against unchanged main", (engine) => {
	engine.integrations = engineIntegrations(
		{ mainQuery: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)), noChange: true },
		[],
	);
});
export const stalledWorker = host.trait("configuration", "the worker stops making progress", (engine) => {
	const provider = engineProvider({ decorateTransport: stalledTransport }, []);
	engine.providerFixture = provider;
	engine.provider = provider.transport;
	engine.policy = Layer.succeed(FleetPolicy)(enginePolicy({ now: () => engine.now }));
	engine.main = { observedAt: 1, revision: "main-0" };
});
export function queuedSubmission(call: "session" | "turn") {
	return host.trait("configuration", `the provider initially rejects ${call} submission`, (engine) => {
		const provider = engineProvider(
			{
				submissionFailure: (current) =>
					engine.rejectSubmission && current === call
						? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" })
						: undefined,
			},
			[],
		);
		engine.providerFixture = provider;
		engine.provider = provider.transport;
		engine.launch = { model: "initial-model" };
		engine.policy = Layer.succeed(FleetPolicy)(enginePolicy({ launch: engine.launch, now: () => engine.now }));
	});
}
export function localBoard(options: { ignored?: boolean; inside?: boolean } = {}) {
	return host.trait("configuration", "the Board has its repository placement and ignore policy", (engine) => {
		engine.localBoard = true;
		engine.localBoardOptions = options;
	});
}
