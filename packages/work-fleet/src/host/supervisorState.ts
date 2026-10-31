import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { processes } from "@shivaedev/work-board/server/processOwnership.ts";

const ProcessState = Schema.Struct({
	pid: Schema.NullOr(Schema.Number),
	port: Schema.Number,
	restarts: Schema.Number,
	revision: Schema.String,
	startedAt: Schema.String,
});
export const SupervisorState = Schema.Struct({
	board: ProcessState,
	daemon: ProcessState,
	log: Schema.String,
	pid: Schema.Number,
	startedAt: Schema.String,
});
export type SupervisorState = typeof SupervisorState.Type;
export type ProcessState = typeof ProcessState.Type;

export function stateFile(root: string) {
	return join(root, ".work-up-status.json");
}
export function logFile(root: string) {
	return join(root, ".work-up.log");
}

export function saveState(root: string, state: SupervisorState) {
	return Effect.tryPromise({
		catch: (cause) => new Error(`Cannot save Fleet supervision status: ${cause}`),
		try: async () => {
			const file = stateFile(root);
			await writeFile(`${file}.tmp`, `${JSON.stringify(state)}\n`);
			await rename(`${file}.tmp`, file);
		},
	});
}

export const supervisionStatus = Effect.fn("FleetSupervisor.supervisionStatus")(function* (root: string) {
	const owner = yield* processes.read(root, "up");
	if (owner?.kind !== "up") {
		return undefined;
	}
	const source = yield* Effect.tryPromise({
		catch: (cause) => new Error(`Cannot read Fleet supervision status: ${cause}`),
		try: () => readFile(stateFile(root), "utf8"),
	});
	const state = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(SupervisorState))(source);
	return state.pid === owner.pid ? state : undefined;
});

export function renderSupervision(state: SupervisorState, now: number) {
	function uptime(startedAt: string) {
		return `${Math.floor((now - Date.parse(startedAt)) / 1000)}s`;
	}
	return [
		`Fleet up pid ${state.pid}, started ${state.startedAt}, uptime ${uptime(state.startedAt)}`,
		...(["daemon", "board"] as const).map((name) => {
			const child = state[name];
			return `${name}: pid ${child.pid ?? "restarting"}, port ${child.port}, uptime ${uptime(child.startedAt)}, restarts ${child.restarts}, code ${child.revision}`;
		}),
		`Logs: ${state.log}`,
	].join("\n");
}
