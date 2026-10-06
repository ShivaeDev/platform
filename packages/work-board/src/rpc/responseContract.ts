import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import {
	DraftInput,
	Question,
	QuestionPreview,
	Reading,
	RecordedResponse,
	ResponseFailed,
	Revision,
	WaitReading,
} from "#browser/responses/schema.ts";
import { index, workspace } from "#rpc/keys.ts";

const locate = query("question", {
	payload: { item: Schema.String, request: Schema.String },
	reads: () => [workspace.list, index.list],
	rejections: { ResponseFailed },
	success: QuestionPreview,
});
const awaitResponse = query("awaitResponse", {
	payload: { after: Schema.optional(Schema.String), question: Schema.String },
	reads: () => [workspace.list, index.list],
	rejections: { ResponseFailed },
	success: WaitReading,
});
const read = query("responses", {
	payload: { question: Schema.String },
	reads: () => [workspace.list, index.list],
	rejections: { ResponseFailed },
	success: Reading,
});
const register = command("registerQuestion", {
	invalidates: () => [workspace.list, index.list],
	payload: { item: Schema.String, request: Schema.String, revision: Revision },
	rejections: { ResponseFailed },
	success: Question,
});
const respond = command("recordResponse", {
	invalidates: () => [workspace.list, index.list],
	payload: DraftInput,
	rejections: { ResponseFailed },
	success: RecordedResponse,
});
export const responseContract = contract("work-board", { commands: [register, respond], queries: [locate, read, awaitResponse] });
