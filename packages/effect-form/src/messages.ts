import { Option, Result, SchemaAST, SchemaIssue, type StandardSchema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

export type FieldMessages = Readonly<Record<string, string>>;

export const noMessages: FieldMessages = {};

const REQUIRED = "Required";

const MINIMUM_LENGTH = "effect/schema/isMinLength";

function refusesEmpty(check: SchemaAST.Filter<unknown>): boolean {
	const representation = check.annotations?.representation;
	if (representation === undefined || representation.id !== MINIMUM_LENGTH) {
		return false;
	}
	const payload = representation.payload;
	if (typeof payload !== "object" || payload === null || !("minLength" in payload)) {
		return false;
	}
	return payload.minLength === 1;
}

const checkHook: SchemaIssue.CheckHook = (issue) => SchemaIssue.defaultCheckHook(issue) ?? (refusesEmpty(issue.filter) ? REQUIRED : undefined);

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1({ checkHook });

function segmentKey(segment: PropertyKey | StandardSchema.StandardSchemaV1.PathSegment): string {
	return typeof segment === "object" ? String(segment.key) : String(segment);
}

export function messagesByField(issue: SchemaIssue.Issue): FieldMessages {
	const messages: Record<string, string> = Object.create(null);
	for (const entry of formatIssue(issue).issues) {
		const head = entry.path?.[0];
		if (head === undefined) {
			continue;
		}
		const name = segmentKey(head);
		if (!Object.hasOwn(messages, name)) {
			messages[name] = entry.message;
		}
	}
	return messages;
}

export function messageAtPath(issue: SchemaIssue.Issue, path: readonly PropertyKey[]): string | undefined {
	for (const entry of formatIssue(issue).issues) {
		if (
			path.every((segment, index) => {
				const found = entry.path?.[index];
				return found !== undefined && segment === (typeof found === "object" ? found.key : found);
			})
		) {
			return entry.message;
		}
	}
	return undefined;
}

export function withoutField(messages: FieldMessages, name: string): FieldMessages {
	if (!Object.hasOwn(messages, name)) {
		return messages;
	}
	const next: Record<string, string> = Object.create(null);
	for (const [key, message] of Object.entries(messages)) {
		if (key !== name) {
			next[key] = message;
		}
	}
	return next;
}

export function literalChoices(input: SchemaAST.AST): readonly SchemaAST.LiteralValue[] | undefined {
	const ast = SchemaAST.toEncoded(input);
	if (ast._tag !== "Union") {
		return undefined;
	}
	const choices: SchemaAST.LiteralValue[] = [];
	for (const member of ast.types) {
		if (member._tag !== "Literal") {
			return undefined;
		}
		choices.push(member.literal);
	}
	return choices;
}

export function messageAt(messages: FieldMessages, name: string): string | undefined {
	return Object.hasOwn(messages, name) ? messages[name] : undefined;
}

export function schemaFeedback<A, E>(decoded: Atom.Atom<AsyncResult.AsyncResult<Result.Result<A, SchemaIssue.Issue>, E>>) {
	const messages = Atom.map(decoded, (result) =>
		Option.match(AsyncResult.value(result), {
			onNone: () => noMessages,
			onSome: (value) => (Result.isFailure(value) ? messagesByField(value.failure) : noMessages),
		}),
	);
	return {
		at: (path: readonly PropertyKey[]) =>
			Atom.map(decoded, (result): string | undefined => {
				if (result.waiting) {
					return undefined;
				}
				return Option.match(AsyncResult.value(result), {
					onNone: () => undefined,
					onSome: (value) => (Result.isFailure(value) ? messageAtPath(value.failure, path) : undefined),
				});
			}),
		field: Atom.family((name: string) => Atom.map(messages, (value) => messageAt(value, name))),
	};
}
