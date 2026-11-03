import { type Cause, type Effect, Exit, Predicate, Result } from "effect";
import { captureOutcome, renderOutcome } from "#server/captureOutcome.ts";

export function words(name: string): string {
	return name
		.replace(/(?<before>[a-z0-9])(?<after>[A-Z])/gu, "$<before> $<after>")
		.replace(/(?<acronym>[A-Z]+)(?<word>[A-Z][a-z])/gu, "$<acronym> $<word>")
		.toLowerCase();
}

export function errorWords(error: unknown): string {
	if (Predicate.hasProperty(error, "_tag") && typeof error._tag === "string") {
		return words(error._tag);
	}
	if (error instanceof Error) {
		return error.name === "Error" ? error.message : words(error.name);
	}
	return String(error);
}

export function decodedErrorWords(error: unknown): string {
	return error instanceof Error ? errorWords(error) : `${errorWords(error)}, left as an undecoded object`;
}

function renderers<A>(explain: (error: unknown) => string) {
	return {
		onDefect: (defect: unknown) => `died with ${explain(defect)}`,
		onFailure: (error: unknown) => `failed with ${explain(error)}`,
		onInterrupt: () => "interrupted",
		onSuccess: (value: A) => value,
	};
}

export function causeWords(cause: Cause.Cause<unknown>, explain: (error: unknown) => string = errorWords): string {
	return renderOutcome(Exit.failCause(cause), renderers<never>(explain));
}

export function answerOf<A>(exit: Exit.Exit<A, unknown>, explain: (error: unknown) => string = errorWords): A | string {
	return renderOutcome(exit, renderers<A>(explain));
}

export function resultOf<A>(result: Result.Result<A, unknown>, explain: (error: unknown) => string = errorWords): A | string {
	return Result.isSuccess(result) ? result.success : `failed with ${explain(result.failure)}`;
}

export function answered<A, E, R>(effect: Effect.Effect<A, E, R>, explain: (error: unknown) => string = errorWords) {
	return captureOutcome(effect, renderers<A>(explain));
}

export function countWords(count: number, thing: string): string {
	if (count === 0) {
		return `no ${thing}s`;
	}
	return count === 1 ? `one ${thing}` : `${count} ${thing}s`;
}
