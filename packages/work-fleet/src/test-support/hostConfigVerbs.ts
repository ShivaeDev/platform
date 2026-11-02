import { renameSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { Context, Effect, Option, Stream } from "effect";
import type { HostConfig } from "#host/config.ts";
import type { ConfigStatus } from "#host/configSettings.ts";
import { configStatus } from "#host/configSettings.ts";
import { LiveConfig } from "#host/liveConfig.ts";
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
			waitForRecord(
				engine.running.client,
				workId,
				(record) => record.step === "working" && record.attempts.at(-1)?.receipt !== undefined,
				engine.running.context,
			),
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
			Context.get(engine.running.context, LiveConfig).changes.pipe(
				Stream.map(configStatus),
				Stream.filter(ready),
				Stream.take(1),
				Stream.runHead,
				Effect.map(Option.getOrThrow),
			),
		waiting: (workId: string) =>
			waitForRecord(
				engine.running.client,
				workId,
				(record) => record.step === "queued" && record.attempts.length === 0 && record.blocker !== undefined,
				engine.running.context,
			),
	};
}
