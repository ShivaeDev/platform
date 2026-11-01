import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { LiveConnection } from "#automaticLive.ts";
import { socketIdentity } from "#internal/rpcClient.ts";
import { shown } from "./answers.ts";
import { records } from "./deniedContract.ts";
import { type DeniedEngine, deniedEngine } from "./deniedEngine.ts";
import { settled } from "./settled.ts";

function shownOf(engine: DeniedEngine) {
	return Effect.map(settled(engine.registry, engine.view), (result) => shown(result, (value) => value));
}
export const deniedStory = storyKit({
	clock: "test",
	create: () => deniedEngine,
	inspect: ({ access, attempts }) => ({ access, attempts }),
	name: "settled live rejections",
	stages: ["answer", "view"],
	verbs: (engine, story) => ({
		allow: () => {
			story.tell("the record becomes readable without notifying the client");
			engine.access.allowed = true;
			engine.access.rejection = "denied";
		},
		announce: (id: number) => {
			story.tell(`a change hint arrives for record ${id}`);
			return Effect.flatMap(engine.clientReactivity, (reactivity) => reactivity.invalidate(invalidationKeys([records.item(id)])));
		},
		announceOnServer: () => {
			story.tell("the server announces a change to the open record");
			return engine.reactivity.invalidate(invalidationKeys([records.item(1)]));
		},
		attempts: () => Effect.sync(() => engine.attempts.length),
		minutePasses: () => {
			story.tell("the page stays open for a minute");
			return TestClock.adjust("1 minute");
		},
		policyChecks: () => Effect.sync(() => engine.access.checks),
		refresh: () => {
			story.tell("the page explicitly refreshes its query");
			engine.registry.refresh(engine.view);
		},
		resume: () => {
			story.tell("the application resumes");
			engine.native.resume();
		},
		revoke: () => {
			story.tell("access to the record is revoked");
			engine.access.allowed = false;
		},
		shown: () => shownOf(engine),
		signIn: () => {
			story.tell("alice signs in with access to the record");
			engine.registry.set(socketIdentity, "alice");
			return until(AtomRegistry.toStream(engine.registry, engine.api[LiveConnection].status), (status) => status.connection === "live", {
				name: "live connection status",
			});
		},
		untilFailed: () =>
			until(AtomRegistry.toStream(engine.registry, engine.api[LiveConnection].status), (status) => status.connection === "failed", {
				name: "live connection status",
			}),
		untilLive: () =>
			until(AtomRegistry.toStream(engine.registry, engine.api[LiveConnection].status), (status) => status.connection === "live", {
				name: "live connection status",
			}),
	}),
});
export function rejected(rejection: "denied" | "NotFound" | "Rejected") {
	return deniedStory.trait("answer", `the server answers with ${rejection}`, (engine) => {
		engine.access.rejection = rejection;
	});
}
export function watching(delivery: "hints" | "pushed") {
	return deniedStory.trait("view", `the page opens a ${delivery} live query`, (engine) =>
		Effect.gen(function* () {
			engine.view = engine.api[delivery].query();
			engine.registry.mount(engine.view);
			yield* shownOf(engine);
			yield* until(
				AtomRegistry.toStream(engine.registry, engine.api[LiveConnection].status),
				(status) => status.connection === (engine.access.allowed ? "live" : "failed"),
				{ name: "live connection status" },
			);
		}),
	);
}

export function readable() {
	return deniedStory.trait("answer", "the record is initially readable", (engine) => {
		engine.access.allowed = true;
	});
}
