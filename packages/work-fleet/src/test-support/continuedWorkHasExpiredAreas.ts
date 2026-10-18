import { engineScenario } from "#test/engineScenario.ts";

export function continuedWorkHasExpiredAreas() {
	return engineScenario("continued human delivery has an expired area reservation", () => {
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
			options: { areaMergeWaitMs: 5000, backlog: 3, denyDelivery: true, now: () => now },
		};
	});
}
