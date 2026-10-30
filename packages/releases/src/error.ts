import { Data } from "effect";

export class ChangesetError extends Data.TaggedError("ChangesetError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {
	constructor({ cause, ...fields }: { readonly message: string; readonly cause?: unknown }) {
		super(fields);
		Object.defineProperty(this, "cause", { configurable: true, enumerable: false, value: cause });
	}
}

export class GitError extends Data.TaggedError("GitError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {
	constructor({ cause, ...fields }: { readonly message: string; readonly cause: unknown }) {
		super(fields);
		Object.defineProperty(this, "cause", { configurable: true, enumerable: false, value: cause });
	}
}
