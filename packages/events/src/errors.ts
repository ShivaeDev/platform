import { Data } from "effect";

export class AlreadyDone extends Data.TaggedError("AlreadyDone")<{
	readonly requestId: string;
	readonly stream: string;
	readonly streamVersion: number;
}> {}

export class StreamConflict extends Data.TaggedError("StreamConflict")<{
	readonly stream: string;
	readonly expectedVersion: number;
	readonly actualVersion: number;
}> {}

export class UnsupportedEventVersion extends Data.TaggedError("UnsupportedEventVersion")<{
	readonly storedVersion: number;
	readonly currentVersion: number;
}> {}
