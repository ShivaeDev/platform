import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { markdownBoard } from "#board/markdown.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import type { HostParts } from "#host/commands.ts";
import { type FleetHost, type HostConfig, loadHost, resolveHost } from "#host/config.ts";
import { CONFIG_FILE } from "#host/defaults.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { recordColumns, recordInput, recordModel } from "#storage/model.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import type { CliRun } from "#test/fleetCli.ts";
import { daemonCli } from "#test/readDaemon.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

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

function hostSql(host: FleetHost) {
	return PgClient.layer({ maxConnections: 2, url: Redacted.make(host.databaseUrl) });
}

export function hostBoard(config?: string) {
	const boardDir = mkdtempSync(join(tmpdir(), "fleet-config-"));
	if (config !== undefined) {
		writeFileSync(join(boardDir, CONFIG_FILE), config);
	}
	return boardDir;
}

export function withHost<A, E, R>(
	files: Readonly<Record<string, string>>,
	config: Partial<HostConfig>,
	use: (fixture: HostFixture) => Effect.Effect<A, E, R>,
) {
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			const boardDir = mkdtempSync(join(tmpdir(), "fleet-host-"));
			const settings: HostConfig = {
				database: { url: storageDatabaseUrl ?? "postgresql://integration-tests-disabled" },
				intervalSeconds: 1,
				namespace: `fh_${crypto.randomUUID().replaceAll("-", "")}`,
				provider: "local",
				quota: "unlimited",
				...config,
			};
			const configFile = join(boardDir, CONFIG_FILE);
			writeFileSync(configFile, JSON.stringify(settings));
			for (const [file, source] of Object.entries(files)) {
				writeFileSync(join(boardDir, file), source);
			}
			return { boardDir, configFile, host: resolveHost(boardDir, settings) };
		}),
		({ boardDir, configFile, host }) => {
			const provider = engineProvider({}, []);
			return use({
				configFile,
				host,
				parts: {
					board: Layer.merge(
						markdownBoard(boardDir).pipe(Layer.provide(NodeServices.layer)),
						Layer.succeed(ReportInspection)({ check: () => Effect.void }),
					),
					main: mainSource,
					provider: provider.transport,
				},
				provider,
				write: (file, source) => writeFileSync(join(boardDir, file), source),
			});
		},
		({ boardDir, host }) =>
			Effect.gen(function* () {
				rmSync(boardDir, { force: true, recursive: true });
				const sql = yield* SqlClient.SqlClient;
				for (const suffix of ["records", "foreign_reservations", "migrations"]) {
					yield* sql`drop table if exists ${sql(`${host.namespace}_${suffix}`)}`;
				}
			}).pipe(Effect.provide(hostSql(host)), Effect.orDie),
	);
}

export function storeState(host: FleetHost, workId: string, payload: Readonly<Record<string, unknown>>) {
	return Effect.gen(function* () {
		yield* migrateFleet(host.namespace);
		const model = recordModel();
		const repository = yield* makeRepository(model, {
			idColumn: "work_id",
			spanPrefix: "Fixture",
			tableName: `${host.namespace}_records`,
			versionColumn: "version",
		});
		const input = yield* Schema.decodeUnknownEffect(model.insert)({ ...recordInput(JSON.stringify(payload), recordColumns()), "work_id": workId });
		const previous = yield* repository.findMany({ where: { "work_id": workId } });
		if (previous[0] === undefined) {
			yield* repository.insertVoid(input);
		} else {
			yield* repository.updateVoid({ ...previous[0], ...input });
		}
	}).pipe(Effect.provide(hostSql(host)), Effect.orDie);
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
