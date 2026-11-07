import type { Duration, Effect } from "effect";
import type { AtomServices } from "#AtomServices.ts";

export interface NoticeDescriptor<R = never, TMessage = unknown> {
	readonly action?:
		| {
				readonly label: TMessage;
				readonly run: Effect.Effect<unknown, unknown, AtomServices<R>>;
		  }
		| undefined;
	readonly expiresIn?: Duration.Input | undefined;
	readonly message: TMessage;
}

export interface NoticeFeedback<TInput, A, E, R = never, TMessage = unknown> {
	readonly onFailure?: (error: E, input: TInput) => NoticeDescriptor<R, TMessage> | undefined;
	readonly onSuccess?: (value: A, input: TInput) => NoticeDescriptor<R, TMessage> | undefined;
}
