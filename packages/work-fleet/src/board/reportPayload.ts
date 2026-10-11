import { Effect, Schema } from "effect";
import { reportIdentity } from "#board/reportIdentity.ts";
import { reportPayloadFile } from "#board/reportPayloadFile.ts";
import { BoardFailure, type BoardWork } from "#policy.ts";
import type { ReportFile } from "#reportAttachments.ts";
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
function decode(content: string) {
	return Schema.decodeUnknownEffect(Schema.fromJsonString(Payload))(content).pipe(
		Effect.filterOrFail(
			(payload) => payload.files.every(validFile) && new Set(payload.files.map((file) => file.path)).size === payload.files.length,
			() => new BoardFailure({ message: "Saved report payload contains invalid files" }),
		),
		Effect.map((payload) => ({
			files: payload.files.map(({ path, base64 }) => ({ bytes: Buffer.from(base64, "base64"), path })),
			output: payload.output,
		})),
		Effect.filterOrFail(
			(payload) =>
				payload.files.length <= REPORT_LIMITS.attachmentCount
				&& payload.files.reduce((size, file) => size + file.bytes.length, 0) <= REPORT_LIMITS.attachmentBytes,
			() => new BoardFailure({ message: "Saved report payload exceeds attachment limits" }),
		),
		Effect.mapError(() => new BoardFailure({ message: "Saved report publication payload is invalid; retain the completed attempt" })),
	);
}
export function reportPayload(root: string, work: BoardWork, observation: SessionObservation) {
	const { itemId } = reportIdentity(work, observation.receipt);
	function saved(content: string | undefined) {
		return content === undefined
			? Effect.fail(new BoardFailure({ message: "Report publication payload could not be recovered or persisted; retry the same completed attempt" }))
			: decode(content);
	}
	return {
		read: reportPayloadFile(root, itemId).pipe(Effect.flatMap((content) => (content === undefined ? Effect.succeed(undefined) : decode(content)))),
		save: (payload: ReportPayload) =>
			reportPayloadFile(
				root,
				itemId,
				JSON.stringify({
					files: payload.files.map(({ path, bytes }) => ({ base64: Buffer.from(bytes).toString("base64"), path })),
					output: payload.output,
				}),
			).pipe(Effect.flatMap(saved)),
	};
}
