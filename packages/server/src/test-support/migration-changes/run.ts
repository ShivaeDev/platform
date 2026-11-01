import process from "node:process";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Redacted } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const runMigrationChanges = Effect.fnUntraced(function* (url: Redacted.Redacted, table: string, mode: "migrate" | "rollback") {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const child = yield* spawner.spawn(
		ChildProcess.make(process.execPath, ["--conditions=source", fileURLToPath(new URL("./process.ts", import.meta.url))], {
			env: { "DATABASE_URL": Redacted.value(url), "MIGRATION_MODE": mode, "MIGRATION_NOTES_TABLE": table },
			extendEnv: true,
			stderr: "inherit",
		}),
	);
	return yield* child.exitCode;
}, Effect.provide(NodeServices.layer));
