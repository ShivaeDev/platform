import { engineConfiguration } from "#test/engineConfiguration.ts";
export const providerWithoutSteering = engineConfiguration("provider without steering", () => ({
	decorateTransport: ({ steer: _steer, ...transport }) => transport,
	reviewRunning: true,
}));
