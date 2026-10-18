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
import { MainSource, unchanged } from "#host/mainSource.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import type { CliRun } from "#test/fleetCli.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { daemonCli } from "#test/readDaemon.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export const MAIN = { observedAt: 1, revision: "main-revision" };

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

const mainSource = Layer.succeed(MainSource)({
	current: Effect.succeed(MAIN),
	observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)),
	refresh: Effect.succeed(MAIN),
	repositoryRoot: "/synthetic-repository",
});

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
		main: mainSource,
		provider,
	};
}

const makeHost = Effect.fn("FleetFixture.makeHost")(function* (files: Readonly<Record<string, string>>, config: Partial<HostConfig>) {
	const database = yield* PostgresTestDatabase;
	return yield* Effect.sync(() => {
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
		const provider = engineProvider({}, []);
		return {
			configFile,
			host: resolveHost(boardDir, settings, configFile),
			parts: hostParts(boardDir, provider.transport),
			provider,
			write: (file: string, source: string) => writeFileSync(join(boardDir, file), source),
		};
	});
});

function closeHost(fixture: HostFixture) {
	return Effect.sync(() => rmSync(fixture.host.boardDir, { force: true, recursive: true }));
}

export function hostFixture(files: Readonly<Record<string, string>>, config: Partial<HostConfig>) {
	return Effect.acquireRelease(makeHost(files, config), closeHost);
}

export function withHost<A, E, R>(
	files: Readonly<Record<string, string>>,
	config: Partial<HostConfig>,
	use: (fixture: HostFixture) => Effect.Effect<A, E, R>,
) {
	return withIsolatedDatabase(Effect.acquireUseRelease(makeHost(files, config), use, closeHost));
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
