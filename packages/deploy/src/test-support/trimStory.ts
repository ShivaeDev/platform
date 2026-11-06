import { volume } from "railway/iac";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { configurePostgres } from "#adapters/railway/configurePostgres.ts";
import type { PageCacheTrim } from "#adapters/railway/postgresStartCommand.ts";
import { runTrimShell, type TrimCheck } from "./trimShell.ts";

export const trim = storyKit({
	create: (): { options: PageCacheTrim } => ({ options: {} }),
	name: "Postgres page cache",
	stages: ["options"],
	verbs: (engine, story) => ({
		checkMemory: (checks: TrimCheck[]) => {
			story.tell("run the deployed shell command through the supplied memory checks");
			const database = configurePostgres("Postgres", {
				limits: { cpu: 1, memoryBytes: 536_870_912 },
				pageCacheTrim: engine.options,
				volume: volume("postgres-data"),
			});
			return runTrimShell(database.deploy?.startCommand ?? "", checks);
		},
	}),
});

export const customTrim = trim.trait("options", "the app chooses a 100-byte threshold, 2-second checks and 10-second fallback", ({ options }) => {
	options.thresholdBytes = 100;
	options.checkIntervalSeconds = 2;
	options.fallbackIntervalSeconds = 10;
});
