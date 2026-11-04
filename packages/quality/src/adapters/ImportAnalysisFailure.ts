import { Data } from "effect";

export class ImportAnalysisFailure extends Data.TaggedError("ImportAnalysisFailure")<{
	readonly message: string;
	readonly root: string;
}> {}
