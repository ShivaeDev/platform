import { Effect, Schema } from "effect";
import { configureCloud } from "#test/cloudHost.ts";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import { task } from "#test/fleetHost.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

const states = new WeakMap<HostStoryEngine, { requests: WireRequest[]; current: string; complete: () => void }>();
export function configureSteeringCloud(engine: HostStoryEngine) {
	engine.externalProcess = true;
	engine.beforeFixture = Effect.gen(function* () {
		const requests: WireRequest[] = [];
		let completed = false;
		let threads = 0;
		yield* configureCloud(engine, (request) => {
			requests.push(request);
			switch (request.method) {
				case "thread/start":
					threads += 1;
					return { thread: { id: threads === 1 ? "synthetic-session" : "synthetic-reviewer" } };
				case "thread/read":
					return {
						thread: { ...cloudThread().thread, id: Schema.decodeUnknownSync(Schema.Struct({ threadId: Schema.String }))(request.params).threadId },
					};
				case "turn/start":
					return { turn: { id: "synthetic-turn" } };
				case "thread/turns/list":
					return { data: [{ id: "synthetic-turn", items: [], status: completed ? "completed" : "inProgress" }], nextCursor: null };
				case "thread/items/list":
					return { data: [], nextCursor: null };
				case "turn/steer":
					return { turnId: "synthetic-turn" };
				default:
					return {};
			}
		});
		const original = task("synthetic-work", "approved", "Original scope.").replace(
			"kind: task",
			"kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]",
		);
		const current = original.replace("Original behavior.", "Changed behavior.");

		engine.files = { "work.md": original };
		states.set(engine, {
			complete: () => {
				completed = true;
			},
			current,
			requests,
		});
	});
}
export function steeringCloudVerbs(engine: HostStoryEngine) {
	function state() {
		const value = states.get(engine);
		if (value === undefined) {
			throw new Error("Configure a steering Cloud worker first");
		}
		return value;
	}
	return {
		cloudSteers: () => state().requests.filter((request) => request.method === "turn/steer"),
		completeCloudTurn: () => state().complete(),
		revisedCloudBrief: () => state().current,
	};
}
