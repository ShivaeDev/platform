import type { FleetRecord } from "#model.ts";

export type AnswerEvent =
	| {
			readonly _tag: "Applied";
			readonly workId: string;
			readonly decisionId: string | null;
			readonly responseId: string | null;
			readonly record: FleetRecord;
	  }
	| { readonly _tag: "Refused"; readonly workId: string; readonly decisionId: string | null; readonly reason: string; readonly requestId?: string }
	| { readonly _tag: "RequestFinished"; readonly workId: string; readonly requestId: string }
	| { readonly _tag: "CompletionFailed"; readonly workId: string; readonly requestId: string };
