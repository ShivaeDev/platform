import { Effect, Schema } from "effect";
import { reportIdentity } from "#board/reportIdentity.ts";
import { reportPayloadFile } from "#board/reportPayloadFile.ts";
import { BoardFailure, type BoardWork } from "#policy.ts";
import type { ReportFile } from "#reportAttachments.ts";
import { ReportFileFailure } from "#reportFileFailure.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";
import type { SessionObservation } from "#session/schema.ts";

const Payload = Schema.Struct({
	files: Schema.Array(Schema.Struct({ base64: Schema.String, path: Schema.String })),
	output: Schema.String,
});
interface ReportPayload {
	readonly files: readonly ReportFile[];
	readonly output: string;
}
function validFile(file: (typeof Payload.Type)["files"][number]) {
	return (
		file.base64 === Buffer.from(file.base64, "base64").toString("base64")
		&& !(file.path.includes("\\") || /\p{Cc}/u.test(file.path))
		&& file.path.split("/").every((part) => part !== "" && part !== "." && part !== ".." && part !== ".git")
	);
}
const decode = Effect.fnUntraced(function* (content: string, payloadPath: string) {
	const payload = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Payload))(content).pipe(
		Effect.mapError((cause) => new ReportFileFailure({ cause, path: payloadPath, reason: `Saved report payload is invalid: ${cause.message}` })),
	);
	const names = new Set<string>();
	for (const file of payload.files) {
		if (!validFile(file) || names.has(file.path)) {
			return yield* Effect.fail(new ReportFileFailure({ path: file.path, reason: `Invalid or duplicate attachment in ${payloadPath}` }));
		}
		names.add(file.path);
	}
	const files = payload.files.map(({ path, base64 }) => ({ bytes: Buffer.from(base64, "base64"), path }));
	if (files.length > REPORT_LIMITS.attachmentCount || files.reduce((size, file) => size + file.bytes.length, 0) > REPORT_LIMITS.attachmentBytes) {
		return yield* Effect.fail(new ReportFileFailure({ path: payloadPath, reason: "Saved report payload exceeds attachment limits" }));
	}
	return { files, output: payload.output };
});
export function reportPayload(root: string, work: BoardWork, observation: SessionObservation) {
	const { itemId } = reportIdentity(work, observation.receipt);
	const payloadPath = `.fleet-reports/${itemId}.json`;
	function saved(content: string | undefined) {
		return content === undefined
			? Effect.fail(
					new ReportFileFailure({
						path: payloadPath,
						reason: "Report payload could not be recovered or persisted; retry the same completed attempt",
					}),
				)
			: decode(content, payloadPath);
	}
	function failure(error: ReportFileFailure) {
		return new BoardFailure({ message: error.message });
	}
	return {
		read: reportPayloadFile(root, itemId).pipe(
			Effect.flatMap((content) => (content === undefined ? Effect.succeed(undefined) : decode(content, payloadPath))),
			Effect.mapError(failure),
		),
		save: (payload: ReportPayload) =>
			reportPayloadFile(
				root,
				itemId,
				JSON.stringify({
					files: payload.files.map(({ path, bytes }) => ({ base64: Buffer.from(bytes).toString("base64"), path })),
					output: payload.output,
				}),
			).pipe(Effect.flatMap(saved), Effect.mapError(failure)),
	};
}
