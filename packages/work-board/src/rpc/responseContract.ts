import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { RequestTracing } from "@shivaedev/identity/middleware.ts";
import { AnswerInput, DraftInput, Question, QuestionPreview, Reading, RecordedResponse, Revision, WaitReading } from "#browser/responses/schema.ts";
import { index, workspace } from "#rpc/keys.ts";
import { responseRejections } from "#rpc/rejections.ts";

const locate = query("question", {
	payload: { item: Schema.String, request: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: responseRejections,
	success: QuestionPreview,
});
const awaitResponse = query("awaitResponse", {
	payload: { after: Schema.optional(Schema.String), question: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: responseRejections,
	success: WaitReading,
});
const read = query("responses", {
	payload: { question: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: () => [workspace.list, index.bucket.workspace("local")],
	rejections: responseRejections,
	success: Reading,
});
const register = command("registerQuestion", {
	invalidates: () => [workspace.list, index.bucket.workspace("local")],
	payload: { item: Schema.String, request: Schema.String, revision: Revision },
	rejections: responseRejections,
	success: Question,
});
const respond = command("recordResponse", {
	invalidates: () => [workspace.list, index.bucket.workspace("local")],
	payload: DraftInput,
	rejections: responseRejections,
	success: RecordedResponse,
});
const answer = command("answerQuestion", {
	invalidates: () => [workspace.list, index.bucket.workspace("local")],
	payload: AnswerInput,
	rejections: responseRejections,
	success: RecordedResponse,
});
export const responseContract = contract("work-board-responses", {
	commands: [register, respond, answer],
	queries: [locate, read, awaitResponse],
}).middleware(RequestTracing);
