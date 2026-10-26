import { Effect } from "effect";
import { reportFileChanges } from "#host/reportFileChanges.ts";
import { CODEX_CLOUD_ENDPOINT } from "#providers/codexCloud.ts";
import { codexCloudConnection } from "#providers/codexCloudConnection.ts";
import type { CodexLogin } from "#providers/codexLogin.ts";
import { type CodexRequest, codexTurns } from "#providers/codexTurns.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";
import type { SessionObservation } from "#session/schema.ts";

export function makeCodexReportAttachments(rpc: CodexRequest) {
	const { readItems } = codexTurns(rpc);
	return (observation: SessionObservation) =>
		readItems(observation.receipt, REPORT_LIMITS.downloadBytes).pipe(Effect.flatMap((items) => reportFileChanges(items, observation.output)));
}
export function codexReportAttachments(login: CodexLogin & { readonly endpoint?: string | undefined }, timeoutMs: number) {
	return (observation: SessionObservation) =>
		Effect.scoped(
			Effect.gen(function* () {
				const { rpc } = yield* codexCloudConnection(login.endpoint ?? CODEX_CLOUD_ENDPOINT, login, timeoutMs);
				return yield* makeCodexReportAttachments(rpc)(observation);
			}),
		);
}
