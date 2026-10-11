import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Clock, Effect, Schema } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { hostProvider } from "#host/providers.ts";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import type { HostFixture } from "#test/fleetHost.ts";

export type Boundary = "before-thread" | "after-thread" | "before-turn" | "after-turn" | "acknowledged-turn";
export function restartBackend(boundary: Boundary) {
	const requests: WireRequest[] = [];
	let sessions = 0;
	let turns = 0;
	let operationId: unknown;
	let reached = false;
	function threadStart() {
		reached = boundary === "before-thread" || boundary === "after-thread";
		if (boundary === "before-thread") {
			return undefined;
		}
		sessions += 1;
		return boundary === "after-thread" ? undefined : { thread: { id: "synthetic-session" } };
	}
	function turnStart(request: WireRequest) {
		reached = true;
		if (boundary === "before-turn") {
			return undefined;
		}
		turns += 1;
		operationId = Schema.decodeUnknownSync(Schema.Struct({ clientUserMessageId: Schema.String }))(request.params).clientUserMessageId;
		return boundary === "after-turn" ? undefined : { turn: { id: "synthetic-turn" } };
	}
	function turnList() {
		const data =
			turns === 0 ? [] : [{ id: "synthetic-turn", items: [{ clientId: operationId, id: "input", type: "userMessage" }], status: "inProgress" }];
		return { data, nextCursor: null };
	}
	return {
		handle(request: WireRequest) {
			requests.push(request);
			switch (request.method) {
				case "thread/start":
					return threadStart();
				case "thread/read":
					return cloudThread();
				case "turn/start":
					return turnStart(request);
				case "thread/turns/list":
					return turnList();
				default:
					return {};
			}
		},
		get reached() {
			return reached;
		},
		requests,
		get sessions() {
			return sessions;
		},
		get turns() {
			return turns;
		},
	};
}

interface Progress {
	readonly done: boolean;
	readonly progress: number;
}

export const until = Effect.fn("CloudRestart.until")(function* (condition: () => Effect.Effect<boolean | Progress, unknown>) {
	let deadline = (yield* Clock.currentTimeMillis) + 20_000;
	let progress = 0;
	while (true) {
		const observed = yield* condition();
		if (typeof observed === "boolean" ? observed : observed.done) {
			return;
		}
		const now = yield* Clock.currentTimeMillis;
		if (typeof observed !== "boolean" && observed.progress > progress) {
			progress = observed.progress;
			deadline = now + 20_000;
		}
		if (now >= deadline) {
			return yield* Effect.die(new Error(`Restart progress stalled at ${progress} for 20 seconds`));
		}
		yield* Effect.sleep("20 millis");
	}
});

export function hostRecord(fixture: HostFixture) {
	return Effect.gen(function* () {
		return (yield* (yield* Fleet).get("synthetic-work")).value;
	}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, provider: hostProvider(fixture.host) })));
}

export function hostProcess(configFile: string) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const child = spawn(process.execPath, ["--conditions=source", fileURLToPath(new URL("./cloudHostProcess.ts", import.meta.url)), configFile], {
				stdio: ["ignore", "ignore", "pipe"],
			});
			let errors = "";
			child.stderr.on("data", (chunk: Buffer) => {
				errors += chunk.toString();
			});
			const exited = new Promise<void>((resolve, reject) => {
				child.on("error", reject);
				child.on("exit", (code, signal) => (signal === "SIGKILL" || code === 0 ? resolve() : reject(new Error(errors))));
			});
			return {
				kill: Effect.promise(async () => {
					child.kill("SIGKILL");
					await exited;
				}),
			};
		}),
		(child) => child.kill,
	);
}
