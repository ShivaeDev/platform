import {
	DraftInput as DraftInputSchema,
	Question as QuestionSchema,
	Reading as ReadingSchema,
	RecordedResponse as RecordedResponseSchema,
} from "#browser/responses/schema.ts";
import { currentResponses } from "#responses/current.ts";
import { Responses } from "#server/Responses.ts";
import { makeResponse } from "#server/responses/make.ts";
import { publish } from "#server/responses/publish.ts";
import { readResponses } from "#server/responses/read.ts";
import { questionFrom, questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { type WorkspaceOptions as InternalWorkspaceOptions, Workspace, WorkspaceConfig } from "#server/workspace.ts";

export type WorkspaceOptions = InternalWorkspaceOptions;
export type DraftInput = typeof DraftInputSchema.Type;
export type Question = typeof QuestionSchema.Type;
export type Reading = typeof ReadingSchema.Type;
export type RecordedResponse = typeof RecordedResponseSchema.Type;

export interface ResponsesIntegration {
	readonly currentResponses: typeof currentResponses;
	readonly DraftInput: typeof DraftInputSchema;
	readonly makeResponse: typeof makeResponse;
	readonly publish: typeof publish;
	readonly Question: typeof QuestionSchema;
	readonly questionFrom: typeof questionFrom;
	readonly questionId: typeof questionId;
	readonly questionMarkdown: typeof questionMarkdown;
	readonly Reading: typeof ReadingSchema;
	readonly RecordedResponse: typeof RecordedResponseSchema;
	readonly Responses: typeof Responses;
	readonly readResponses: typeof readResponses;
	readonly responseMarkdown: typeof responseMarkdown;
	readonly revisionOf: typeof revisionOf;
	readonly Workspace: typeof Workspace;
	readonly WorkspaceConfig: typeof WorkspaceConfig;
}

export const responses: ResponsesIntegration = {
	currentResponses,
	DraftInput: DraftInputSchema,
	makeResponse,
	publish,
	Question: QuestionSchema,
	questionFrom,
	questionId,
	questionMarkdown,
	Reading: ReadingSchema,
	RecordedResponse: RecordedResponseSchema,
	Responses,
	readResponses,
	responseMarkdown,
	revisionOf,
	Workspace,
	WorkspaceConfig,
};
