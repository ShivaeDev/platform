import { Effect } from "effect";
import { Conflict, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { engineScenario } from "#test/engineScenario.ts";

export function deliveryChangesAfterAreaRelease() {
	return engineScenario("delivery can change after the area reservation expires", () => {
		let now = 100;
		let changed = false;
		return {
			context: {
				get changed() {
					return changed;
				},
				set changed(value: typeof changed) {
					changed = value;
				},
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
			},
			options: {
				areaMergeWaitMs: 5000,
				backlog: 3,
				deliveryQuery: () => (changed ? Effect.fail(new Forbidden({ message: "PR closed without merging" })) : Effect.succeed(undefined)),
				now: () => now,
			},
		};
	});
}
export function deliveryEvidenceCanDisappear() {
	return engineScenario("valid delivery evidence can disappear before the area wait expires", () => {
		let now = 100;
		let changed = false;
		return {
			context: {
				get changed() {
					return changed;
				},
				set changed(value: typeof changed) {
					changed = value;
				},
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
			},
			options: {
				areaMergeWaitMs: 5000,
				deliveryQuery: () => (changed ? Effect.fail(new Conflict({ message: "PR head moved" })) : Effect.succeed(undefined)),
				now: () => now,
			},
		};
	});
}
