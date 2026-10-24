import { Context, Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { discoveryDaemon } from "#test/discoveryDaemon.ts";
import type { Follower } from "#test/followerProcess.ts";
import { HostStoryEngine } from "#test/HostStoryEngine.ts";

export class DaemonStoryEngine extends HostStoryEngine {
	follower: Follower | undefined;
	#daemon: Effect.Success<ReturnType<typeof discoveryDaemon>> | undefined;

	get daemon() {
		if (this.#daemon === undefined) {
			throw new Error("Deploy the daemon before observing it");
		}
		return this.#daemon;
	}

	override start(port = 0) {
		return super.start(port).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					this.#daemon = {
						close: this.stop(),
						port: this.running.port,
						reactivity: Context.get(this.running.context, Reactivity.Reactivity),
						subscribed: this.subscribed,
					};
				}),
			),
		);
	}
}
