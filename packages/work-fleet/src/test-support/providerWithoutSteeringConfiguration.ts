import type { EngineOptions } from "#test/EngineOptions.ts";

export function providerWithoutSteeringConfiguration() {
	return (): EngineOptions => ({
		decorateTransport: ({ steer: _steer, ...transport }) => transport,
		reviewRunning: true,
	});
}
