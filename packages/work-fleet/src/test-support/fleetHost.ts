import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { HostParts } from "#host/commands.ts";
import { type FleetHost, type HostConfig, resolveHost } from "#host/config.ts";
import { CONFIG_FILE } from "#host/defaults.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { type EngineProvider, engineProvider } from "#test/engineProvider.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

export const MAIN = { observedAt: 1, revision: "main-revision" };

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

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
			const provider = engineProvider({});
			return use({
				configFile,
				host,
				parts: { main: mainSource, provider: provider.transport },
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

// Wait reads only the stored payload, so terminal states are written directly instead of driving every integration.
export function storeState(host: FleetHost, workId: string, payload: Readonly<Record<string, unknown>>) {
	return Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* migrateFleet(host.namespace);
		const value = JSON.stringify({ workId, ...payload });
		yield* sql`insert into ${sql(`${host.namespace}_records`)} (work_id, version, payload) values (${workId}, 1, ${value}::jsonb)
			on conflict (work_id) do update set version = ${sql(`${host.namespace}_records`)}.version + 1, payload = excluded.payload`;
	}).pipe(Effect.provide(hostSql(host)), Effect.orDie);
}

export interface WaitRun {
	readonly code: number | null;
	readonly stdout: string;
}

export function waitProcess(
	configFile: string,
	workId: string,
	{ intervalSeconds = 0.1, timeoutSeconds = 20 }: { readonly intervalSeconds?: number; readonly timeoutSeconds?: number } = {},
): Promise<WaitRun> {
	return new Promise((resolve, reject) => {
		const args = [
			"--conditions=source",
			CLI,
			"wait",
			workId,
			"--config",
			configFile,
			"--interval",
			String(intervalSeconds),
			"--timeout",
			String(timeoutSeconds),
		];
		const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "ignore"] });
		let stdout = "";
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => resolve({ code, stdout: stdout.trim() }));
	});
}
