import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { createEngine, label, type Options } from "./engine.ts";
import { type Change, Current, makeDatabase } from "./fakeDatabase.ts";
import { verbs } from "./verbs.ts";

export const changes = storyKit({
	create: createEngine,
	inspect: (engine) => ({
		captured: engine.captured,
		committed: Object.fromEntries([...engine.owners].map(([name, owner]) => [name, owner.committed])),
		guarded: engine.guarded,
		hooks: engine.hooks,
		observed: engine.observed,
		published: engine.published,
		timeline: engine.timeline,
	}),
	name: "change channel",
	stages: ["owners", "channel", "frames"],
	verbs: (engine, story) => verbs(engine, story.tell),
});

export function hasOwner(name: string, commit: Effect.Effect<void> = Effect.void) {
	return changes.trait("owners", `${name} owns a deterministic transaction`, (engine) => {
		engine.owners.set(name, makeDatabase(name, commit));
	});
}

export function configured(options: Options) {
	return changes.trait("channel", "the channel uses the declared delivery policy", (engine) => {
		Object.assign(engine.options, options);
	});
}

export function guardsUnowned(refuse = false) {
	return changes.trait("channel", `the unowned guard ${refuse ? "refuses" : "observes"} unframed work`, (engine) => {
		Object.assign(engine.options, {
			unowned: Effect.flatMap(Current, (owner) => {
				engine.guarded.push(owner.name);
				return refuse ? Effect.die(new Error("a native transaction the channel does not own is open")) : Effect.void;
			}),
		});
	});
}

export function beforeCommitWrites() {
	return changes.trait("channel", "the root hook writes within its transaction", (engine) => {
		Object.assign(engine.options, {
			beforeCommit: (entries: readonly Change[]) =>
				Effect.gen(function* () {
					const owner = yield* Current;
					if (owner.committed.length > 0) {
						return yield* Effect.die("the hook ran after commit");
					}
					engine.hooks.push(entries.map((entry) => entry.subject));
					yield* owner.write("hook");
				}),
		});
	});
}

export function countsHooks() {
	return changes.trait("channel", "the hook captures each invocation", (engine) => {
		Object.assign(engine.options, {
			beforeCommit: (entries: readonly Change[]) =>
				Effect.sync(() => {
					engine.hooks.push(entries.map((entry) => entry.subject));
				}),
		});
	});
}

export function hasObserver() {
	return changes.trait("channel", "an observer captures the change lifecycle", (engine) => {
		engine.observer = (observation) =>
			Effect.sync(() => {
				const line = `${observation._tag} ${observation.changes.map(label).join(" ")}`;
				engine.observed.push(line);
				engine.timeline.push(line);
			});
	});
}

export function hasSink() {
	return changes.trait("channel", "a scoped sink captures delivery", (engine) => {
		engine.sink = (entries) =>
			Effect.sync(() => {
				engine.captured.push(entries.map(label));
				engine.timeline.push(`Sink ${entries.map(label).join(" ")}`);
			});
	});
}

export function commitPauses() {
	return changes.trait("owners", "the main owner waits for permission to finish commit", function* (engine) {
		const committing = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		engine.gate = { committing, release };
		engine.owners.set("main", makeDatabase("main", Effect.andThen(Deferred.succeed(committing, undefined), Deferred.await(release))));
	});
}

export function hasNestedFrames() {
	return changes.trait("frames", "a child frame belongs to an open parent", function* (engine) {
		const { open } = verbs(engine, () => undefined);
		const parent = yield* open();
		engine.frames.set("parent", parent);
		engine.frames.set("child", yield* open(undefined, parent));
	});
}
