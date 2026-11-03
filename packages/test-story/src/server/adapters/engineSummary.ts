import { inspect } from "node:util";

const MAX_CHARACTERS = 2000;

export function engineSummary(engine: unknown): string {
	const summary = inspect(engine, {
		breakLength: 100,
		customInspect: false,
		depth: 2,
		getters: false,
		maxArrayLength: 10,
		maxStringLength: 200,
	});
	return summary.length <= MAX_CHARACTERS ? summary : `${summary.slice(0, MAX_CHARACTERS)}…`;
}
