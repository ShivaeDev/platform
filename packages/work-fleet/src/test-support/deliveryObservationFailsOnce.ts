import { engineScenario } from "#test/engineScenario.ts";

export function deliveryObservationFailsOnce() {
	return engineScenario("delivery observation fails once and time can advance", () => {
		let now = 100;
		return {
			context: {
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
			},
			options: { deliveryFailure: true, now: () => now },
		};
	});
}
