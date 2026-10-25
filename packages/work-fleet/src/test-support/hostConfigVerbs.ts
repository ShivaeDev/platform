import { renameSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { Context, Effect } from "effect";
import type { HostConfig } from "#host/config.ts";
import type { ConfigStatus } from "#host/configSettings.ts";
import { FleetPolicy } from "#policy.ts";
import { waitForRecord } from "#test/daemonActions.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export function hostConfigVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	let written = engine.fixture.host.config;
	function edit(settings: Partial<HostConfig>, replace = false) {
		return Effect.sync(() => {
			written = { ...written, ...settings };
			const file = engine.fixture.configFile;
			writeFileSync(replace ? `${file}.saving` : file, JSON.stringify(written));
			if (replace) {
				renameSync(`${file}.saving`, file);
			}
		});
	}
	return {
		edit,
		editConfig: (settings: Partial<HostConfig>) =>
			Effect.sync(() => {
				tell("edit the running daemon's configuration file");
				Object.assign(engine.config, settings);
				engine.fixture.write(basename(engine.fixture.configFile), JSON.stringify({ ...engine.fixture.host.config, ...engine.config }));
			}),
		editText: (text: string) => Effect.sync(() => writeFileSync(engine.fixture.configFile, text)),
		launched: (workId: string) =>
			waitForRecord(engine.running.client, workId, (record) => record.step === "working" && record.attempts.at(-1)?.receipt !== undefined),
		policy: () =>
			Effect.suspend(() => {
				const policy = Context.get(engine.running.context, FleetPolicy);
				return policy.current ?? Effect.succeed(policy);
			}),
		replace: (settings: Partial<HostConfig>) => edit(settings, true),
		sessionSettings: (operationId: string | undefined) =>
			engine.fixture.provider.settings.find((entry) => entry.call === "session" && entry.operationId === operationId)?.settings,
		setChecksPending: (pending: boolean) => {
			if (engine.pullRequest === undefined) {
				throw new Error("Configure the GitHub pull request before changing checks");
			}
			tell(`GitHub checks become ${pending ? "pending" : "green"}`);
			engine.pullRequest.state.pending = pending;
		},
		waitForConfig: (ready: (config: ConfigStatus) => boolean) =>
			Effect.gen(function* () {
				while (true) {
					const config = (yield* engine.running.client("daemon.status", {})).config;
					if (config !== undefined && ready(config)) {
						return config;
					}
					yield* Effect.sleep("20 millis");
				}
			}).pipe(Effect.timeout("10 seconds")),
		waiting: (workId: string) =>
			waitForRecord(
				engine.running.client,
				workId,
				(record) => record.step === "queued" && record.attempts.length === 0 && record.blocker !== undefined,
			),
	};
}
