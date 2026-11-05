import { Data } from "effect";

export class HostProcessError extends Data.TaggedError("HostProcessError")<{
	readonly operation: "launch" | "signal" | "request" | "readout";
	readonly cause: unknown;
}> {}
