import { Predicate } from "effect";
import { failureKind } from "@shivaedev/contract/failureKind.ts";
import type { FieldRejection } from "@shivaedev/form/fieldRejection.ts";
import type { FailureChoices } from "#client/failures.ts";
import type { NoticeDescriptor } from "#client/notices.ts";

export type Decision<R = never> =
	| { readonly _tag: "field"; readonly rejection: FieldRejection<string> }
	| { readonly _tag: "notice"; readonly descriptor: NoticeDescriptor<R> }
	| { readonly _tag: "silent" }
	| { readonly _tag: "unexpected" };

const silent = { _tag: "silent" } as const;
const unexpected = { _tag: "unexpected" } as const;

function isFieldRejection(value: object): value is FieldRejection<string> {
	return (
		Predicate.hasProperty(value, "field")
		&& (Predicate.isString(value.field) || Array.isArray(value.field))
		&& Predicate.hasProperty(value, "message")
		&& Predicate.isString(value.message)
	);
}

function isDescriptor<R>(value: object): value is NoticeDescriptor<R> {
	return Predicate.hasProperty(value, "message");
}

function outcome<R>(value: unknown): Decision<R> {
	if (!Predicate.isObject(value)) {
		return silent;
	}
	if (isFieldRejection(value)) {
		return { _tag: "field", rejection: value };
	}
	return isDescriptor<R>(value) ? { _tag: "notice", descriptor: value } : silent;
}

function messageOf(error: unknown): string {
	return Predicate.hasProperty(error, "message") && Predicate.isString(error.message) ? error.message : "";
}

// The app's handler for the tag wins, then a field the form owns, then the server's message for a request rejection; anything else
// belongs to the application's failure host.
export function decide<R>(
	error: unknown,
	input: unknown,
	choices: FailureChoices,
	field: (error: unknown) => FieldRejection<string> | undefined,
): Decision<R> {
	if (choices.silent === true) {
		return silent;
	}
	const tag = Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag) ? error._tag : undefined;
	const choice = tag === undefined ? undefined : choices.failures?.[tag];
	if (choice === "silent") {
		return silent;
	}
	if (choice === "message") {
		return { _tag: "notice", descriptor: { message: messageOf(error) } };
	}
	if (Predicate.isFunction(choice)) {
		return outcome<R>(choice(error, input));
	}
	const routed = field(error);
	if (routed !== undefined) {
		return { _tag: "field", rejection: routed };
	}
	return failureKind(error) === "request" ? { _tag: "notice", descriptor: { message: messageOf(error) } } : unexpected;
}
