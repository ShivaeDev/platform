import { Data, type Redacted } from "effect";

export class ProviderRejected extends Data.TaggedError("ProviderRejected")<{
	readonly status: number;
	readonly token: string;
	readonly detail: { readonly original: Redacted.Redacted<string>; readonly reason: string };
	readonly message?: string;
}> {}
