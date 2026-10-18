import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Redacted } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { markdownBoard } from "#board/markdown.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import type { HostParts } from "#host/commands.ts";
import { type FleetHost, type HostConfig, resolveHost } from "#host/config.ts";
import { loadHost } from "#host/configFile.ts";
import { CONFIG_FILE } from "#host/defaults.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import type { CliRun } from "#test/fleetCli.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { fixedMainSource } from "#test/mainSource.ts";
import { daemonCli } from "#test/readDaemon.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export function task(id: string, fleet?: string, body = "Do the work.") {
	return `---\nid: ${id}\nkind: task\n${fleet === undefined ? "" : `fleet: ${fleet}\n`}---\n# ${id}\n\n${body}\n`;
}

export interface HostFixture {
	readonly configFile: string;
	readonly host: FleetHost;
	readonly parts: HostParts;
	readonly provider: EngineProvider;
	readonly write: (file: string, source: string) => void;
}

export function hostBoard(config?: string) {
	const boardDir = mkdtempSync(join(tmpdir(), "fleet-config-"));
	if (config !== undefined) {
		writeFileSync(join(boardDir, CONFIG_FILE), config);
	}
	return boardDir;
}

function hostParts(boardDir: string, provider: EngineProvider["transport"]): HostParts {
	return {
		board: Layer.merge(
			markdownBoard(boardDir).pipe(Layer.provide(NodeServices.layer)),
			Layer.succeed(ReportInspection)({ check: () => Effect.void }),
		),
		github: syntheticGithub().layer,
		main: fixedMainSource(),
		provider,
	};
}

export function withHost<A, E, R>(
	files: Readonly<Record<string, string>>,
	config: Partial<HostConfig>,
	use: (fixture: HostFixture) => Effect.Effect<A, E, R>,
) {
	return withIsolatedDatabase(
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			return yield* Effect.acquireUseRelease(
				Effect.sync(() => {
					const boardDir = mkdtempSync(join(tmpdir(), "fleet-host-"));
					const settings: HostConfig = {
						intervalSeconds: 1,
						namespace: STORAGE_NAMESPACE,
						provider: "local",
						quota: "unlimited",
						...config,
						database: { ...config.database, url: Redacted.value(database.url) },
					};
					const configFile = join(boardDir, CONFIG_FILE);
					writeFileSync(configFile, JSON.stringify(settings));
					for (const [file, source] of Object.entries(files)) {
						writeFileSync(join(boardDir, file), source);
					}
					return { boardDir, configFile, host: resolveHost(boardDir, settings, configFile) };
				}),
				({ boardDir, configFile, host }) => {
					const provider = engineProvider({}, []);
					return use({
						configFile,
						host,
						parts: hostParts(boardDir, provider.transport),
						provider,
						write: (file, source) => writeFileSync(join(boardDir, file), source),
					});
				},
				({ boardDir }) => Effect.sync(() => rmSync(boardDir, { force: true, recursive: true })),
			);
		}),
	);
}

export function waitProcess(
	configFile: string,
	workId: string,
	{ intervalSeconds = 0.1, timeoutSeconds = 20 }: { readonly intervalSeconds?: number; readonly timeoutSeconds?: number } = {},
): Promise<CliRun> {
	return Effect.runPromise(
		loadHost(dirname(configFile), configFile).pipe(
			Effect.flatMap((host) => daemonCli(host, ["wait", workId, "--interval", String(intervalSeconds), "--timeout", String(timeoutSeconds)])),
			Effect.provide(NodeServices.layer),
		),
	);
}
