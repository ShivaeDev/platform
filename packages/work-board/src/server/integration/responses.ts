import {
	DraftInput as DraftInputSchema,
	Question as QuestionSchema,
	Reading as ReadingSchema,
	RecordedResponse as RecordedResponseSchema,
} from "#browser/responses/schema.ts";
import { currentResponses } from "#responses/current.ts";
import { makeResponse } from "#server/responses/make.ts";
import { publish } from "#server/responses/publish.ts";
import { readResponses } from "#server/responses/read.ts";
import { questionFrom, questionId, questionMarkdown, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { type ResponseOptions as InternalResponseOptions, ResponseConfig, Responses } from "#server/responses/service.ts";

export type ResponseOptions = InternalResponseOptions;
export type DraftInput = typeof DraftInputSchema.Type;
export type Question = typeof QuestionSchema.Type;
export type Reading = typeof ReadingSchema.Type;
export type RecordedResponse = typeof RecordedResponseSchema.Type;

export const responses = {
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
	ResponseConfig,
	Responses,
	readResponses,
	responseMarkdown,
	revisionOf,
} as const;
