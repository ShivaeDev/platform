import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { LiveConnection } from "#automaticLive.ts";
import { querySignals } from "#querySignals.ts";
import { socketIdentity } from "#rpcClient.ts";
import { shown } from "#test/answers.ts";
import { records } from "#test/deniedContract.ts";
import { type DeniedEngine, deniedEngine } from "#test/deniedEngine.ts";
import { settled } from "#test/settled.ts";

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
		commandSucceeds: () => {
			story.tell("the client's command declaring the record's key succeeds");
			return engine.run(engine.api.touch.run());
		},
		minutePasses: () => {
			story.tell("the page stays open for a minute");
			return TestClock.adjust("1 minute");
		},
		policyChecks: () => Effect.sync(() => engine.access.checks),
		refresh: () => {
			story.tell("the page explicitly refreshes its query and its read completes");
			const signals = querySignals(engine.view);
			const before = engine.registry.get(signals).completed;
			engine.registry.refresh(engine.view);
			return until(AtomRegistry.toStream(engine.registry, signals), (current) => current.completed > before, { name: "refreshed query" });
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
export function watching(query: "pushed" | "unkeyed" = "pushed") {
	const opened = query === "pushed" ? "a pushed live query" : "a pushed live query that declares no reads";
	return deniedStory.trait("view", `the page opens ${opened}`, (engine) =>
		Effect.gen(function* () {
			engine.view = engine.api[query].query();
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
