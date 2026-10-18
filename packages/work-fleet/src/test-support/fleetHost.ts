import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Redacted } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { markdownBoard } from "#board/markdown.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import type { HostParts } from "#host/commands.ts";
import { type FleetHost, type HostConfig, resolveHost } from "#host/config.ts";
import { CONFIG_FILE } from "#host/defaults.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { fixedMainSource } from "#test/mainSource.ts";
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

export const hostFixture = Effect.fn("FleetFixture.hostFixture")(function* (
	files: Readonly<Record<string, string>> = {},
	config: Partial<HostConfig> = {},
	directoryPrefix = "fleet-host-",
) {
	const database = yield* PostgresTestDatabase;
	const fixture = yield* Effect.acquireRelease(
		Effect.sync(() => {
			const boardDir = mkdtempSync(join(tmpdir(), directoryPrefix));
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
		({ boardDir: folder }) => Effect.sync(() => rmSync(folder, { force: true, recursive: true })),
	);
	const provider = engineProvider({}, []);
	return {
		configFile: fixture.configFile,
		host: fixture.host,
		parts: hostParts(fixture.boardDir, provider.transport),
		provider,
		write: (file: string, source: string) => writeFileSync(join(fixture.boardDir, file), source),
	} satisfies HostFixture;
});

export function withHost<A, E, R>(
	files: Readonly<Record<string, string>>,
	config: Partial<HostConfig>,
	use: (fixture: HostFixture) => Effect.Effect<A, E, R>,
) {
	return withIsolatedDatabase(hostFixture(files, config).pipe(Effect.flatMap(use)));
}
