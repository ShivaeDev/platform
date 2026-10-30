import {
	DraftInput as DraftInputSchema,
	Question as QuestionSchema,
	Reading as ReadingSchema,
	RecordedResponse as RecordedResponseSchema,
} from "#browser/responses/schema.ts";
import { currentResponses } from "#responses/current.ts";
import { Responses } from "#server/Responses.ts";
import { makeResponse } from "#server/responses/make.ts";
import { openQuestions } from "#server/responses/openQuestions.ts";
import { publish } from "#server/responses/publish.ts";
import { questionSourceMatches } from "#server/responses/questionSourceMatches.ts";
import { readResponses } from "#server/responses/read.ts";
import { questionFrom, questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";

export type DraftInput = typeof DraftInputSchema.Type;
export type Question = typeof QuestionSchema.Type;
export type Reading = typeof ReadingSchema.Type;
export type RecordedResponse = typeof RecordedResponseSchema.Type;

export const responses = {
	currentResponses,
	DraftInput: DraftInputSchema,
	makeResponse,
	openQuestions,
	publish,
	Question: QuestionSchema,
	questionFrom,
	questionId,
	questionMarkdown,
	questionSourceMatches,
	Reading: ReadingSchema,
	RecordedResponse: RecordedResponseSchema,
	Responses,
	readResponses,
	responseMarkdown,
	revisionOf,
	Workspace,
	WorkspaceConfig,
} as const;
