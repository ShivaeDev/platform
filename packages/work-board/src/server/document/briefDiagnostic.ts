import { Effect } from "effect";
import { DAEMON_PORT } from "#diagnostics/daemonContract.ts";
import { readDaemon } from "#server/diagnostics/daemon.ts";
import type { ParsedMetadata } from "#server/metadata/parse.ts";

export function briefDiagnostic(parsed: ParsedMetadata, sourcePath: string, fleetPort: number | null = DAEMON_PORT) {
	const workId = parsed.fields.id;
	if (fleetPort === null || workId === undefined || parsed.fields.kind !== "task" || ["done", "dropped"].includes(parsed.fields.status ?? "")) {
		return Effect.succeed([]);
	}
	return readDaemon(fleetPort, (client) => client("daemon.briefProblem", { sourcePath, workId })).pipe(
		Effect.map((message) => (message === null ? [] : [{ field: "id", line: parsed.lines.id ?? 2, message }])),
		Effect.catch(() => Effect.succeed([])),
	);
}
