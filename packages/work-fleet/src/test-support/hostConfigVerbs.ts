import { basename } from "node:path";
import { Effect } from "effect";
import type { HostConfig } from "#host/config.ts";
import type { ReloadDaemon } from "#test/configReload.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export function hostConfigVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		editConfig: (settings: Partial<HostConfig>) =>
			Effect.sync(() => {
				tell("edit the running daemon's configuration file");
				Object.assign(engine.config, settings);
				engine.fixture.write(basename(engine.fixture.configFile), JSON.stringify({ ...engine.fixture.host.config, ...engine.config }));
			}),
		setChecksPending: (pending: boolean) => {
			if (engine.pullRequest === undefined) {
				throw new Error("Configure the GitHub pull request before changing checks");
			}
			tell(`GitHub checks become ${pending ? "pending" : "green"}`);
			engine.pullRequest.state.pending = pending;
		},
		waitForConfig: (ready: Parameters<ReloadDaemon["config"]>[0]) =>
			Effect.gen(function* () {
				while (true) {
					const config = (yield* engine.running.client("daemon.status", {})).config;
					if (config !== undefined && ready(config)) {
						return config;
					}
					yield* Effect.sleep("20 millis");
				}
			}).pipe(Effect.timeout("10 seconds")),
	};
}
