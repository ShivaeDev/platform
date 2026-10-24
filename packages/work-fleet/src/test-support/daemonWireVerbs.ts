import { Effect } from "effect";
import type { DaemonEngine } from "#test/daemonStory.ts";
import { followServer } from "#test/followServer.ts";

export function daemonWireVerbs(engine: DaemonEngine, story: { tell: (line: string) => void }) {
	return {
		awaitWire: () => {
			if (engine.wire === undefined) {
				return Effect.die("Start the wire server first");
			}
			const wire = engine.wire;
			return Effect.promise(() => wire.subscribed);
		},
		failWire: (message: string) => {
			if (engine.wire === undefined) {
				throw new Error("Start the wire server first");
			}
			story.tell("the daemon fails the subscription");
			engine.wire.fail(message);
		},
		sendWire: (states: readonly unknown[]) => {
			if (engine.wire === undefined) {
				throw new Error("Start the wire server first");
			}
			story.tell("the daemon streams version-skewed snapshots");
			engine.wire.send(states);
		},
		wireServer: () =>
			Effect.gen(function* () {
				story.tell("serve a daemon protocol from a different version");
				engine.wire = yield* followServer();
				return engine.wire.port;
			}),
	};
}
