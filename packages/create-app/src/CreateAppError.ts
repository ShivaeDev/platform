import { Data } from "effect";

export class CreateAppError extends Data.TaggedError("CreateAppError")<{ readonly message: string }> {
	constructor(fields: { readonly message: string }, options?: ErrorOptions) {
		super(fields);
		Object.defineProperty(this, "cause", { value: options?.cause });
	}
}
