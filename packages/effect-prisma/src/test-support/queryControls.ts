import { Effect } from "effect";
import type { RuntimeControls } from "#test/runtimeControls.ts";
import { signal } from "#test/runtimeControls.ts";

export const controlledUsers = [1, 2, 3].map((number) => ({
	email: `controlled-${crypto.randomUUID()}@example.test`,
	id: crypto.randomUUID(),
	name: String(number),
}));
export const controlledRows = controlledUsers.map(({ id }) => ({ id }));
export function queryControl(controls: RuntimeControls, mode: "parallel" | "serial" | "failure" | "stream" | "drain") {
	const first = signal();
	const both = signal();
	const released = signal();
	let active = 0;
	const events: string[] = [];
	const activeQueries = new Set<string>();
	const startedQueries: string[] = [];
	const concurrentQueries: string[][] = [];
	const state = { activeQueries, both, concurrentQueries, events, first, maximumActive: 0, release: released.resolve, started: 0, startedQueries };
	controls.resume = released.resolve;
	controls.beforeQuery = async () => {
		state.started += 1;
		active += 1;
		const queryId = `query-${state.started}`;
		startedQueries.push(queryId);
		activeQueries.add(queryId);
		concurrentQueries.push([...activeQueries]);
		state.maximumActive = Math.max(active, state.maximumActive);
		if (state.started === 1) {
			first.resolve();
		}
		if (state.started === 2) {
			both.resolve();
		}
		await coordinate();
	};
	async function coordinate() {
		if (mode === "failure" && state.started === 1) {
			active -= 1;
			activeQueries.delete("query-1");
			throw new Error("expected query failure");
		}
		if (mode === "stream") {
			state.events.push(state.started === 1 ? "source:start" : "lookup");
		}
		if (mode === "drain") {
			controls.calls.push(`query${state.started}`);
		}
		if (mode === "parallel" || ((mode === "serial" || mode === "drain") && state.started === 1)) {
			await released.promise;
		}
	}

	controls.afterQuery = () => {
		active -= 1;
		const completed = activeQueries.values().next();
		if (!completed.done) {
			activeQueries.delete(completed.value);
		}
		if (mode === "stream" && state.started === 1) {
			state.events.push("source:end");
		}
	};
	return state;
}
export type QueryControl = ReturnType<typeof queryControl>;

export function queryState(): { current?: QueryControl } {
	return {};
}
export function resetQueryControls(controls: RuntimeControls) {
	controls.resume();
	controls.beforeQuery = () => Promise.resolve();
	controls.afterQuery = () => undefined;
}
export function clearQueryControls(controls: RuntimeControls) {
	return Effect.addFinalizer(() => Effect.sync(() => resetQueryControls(controls)));
}
