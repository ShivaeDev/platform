import { Effect } from "effect";
import { DAEMON_PORT } from "#diagnostics/daemonContract.ts";
import type { ParsedMetadata } from "#integration/metadata.ts";
import { readDaemon } from "#server/diagnostics/daemon.ts";

export function fleetChecksBrief(kind: string | undefined, status: string | undefined) {
	return kind === "task" && !["done", "dropped"].includes(status ?? "");
}

export function briefDiagnostic(parsed: ParsedMetadata, sourcePath: string, fleetPort: number | null = DAEMON_PORT) {
	const workId = parsed.fields.id;
	if (fleetPort === null || workId === undefined || !fleetChecksBrief(parsed.fields.kind, parsed.fields.status)) {
		return Effect.succeed([]);
	}
	return readDaemon(fleetPort, (client) => client("daemon.briefProblems", { briefs: [{ sourcePath, workId }] })).pipe(
		Effect.map((refusals) => refusals.map(({ message }) => ({ field: "id", line: parsed.lines.id ?? 2, message }))),
		Effect.catch(() => Effect.succeed([])),
	);
}
