import { engineProvider } from "#test/engineProvider.ts";
import { host } from "#test/hostStory.ts";

export const runningReviewer = host.trait("configuration", "the independent reviewer keeps running", (engine) => {
	const provider = engineProvider({ reviewRunning: true }, engine.reviews);
	engine.providerFixture = provider;
	engine.provider = provider.transport;
});
