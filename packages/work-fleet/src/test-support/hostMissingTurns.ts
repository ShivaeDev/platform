import { Effect, Layer } from "effect";
import { SessionTransport } from "#session/service.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { host } from "#test/hostStory.ts";
import { missingTurnTransport } from "#test/missingTurnTransport.ts";

export const hostMissingTurns = host.trait("configuration", "the provider has lost recorded turns", (engine) => {
	const missing = missingTurnTransport();
	const provider = engineProvider({}, []);
	engine.providerFixture = provider;
	engine.lostTurns = missing;
	engine.provider = Layer.effect(SessionTransport)(SessionTransport.pipe(Effect.map(missing.decorate))).pipe(Layer.provide(provider.transport));
});
