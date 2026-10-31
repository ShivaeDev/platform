import { Option, Result, SchemaAST, SchemaIssue, type StandardSchema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

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

function formatter(required = REQUIRED) {
	return SchemaIssue.makeFormatterStandardSchemaV1({
		checkHook: (issue) => SchemaIssue.defaultCheckHook(issue) ?? (refusesEmpty(issue.filter) ? required : undefined),
	});
}

const formatIssue = formatter();

function formattedIssues(issue: SchemaIssue.Issue, requiredMessages: Readonly<Partial<Record<string, string>>>) {
	const issues = formatIssue(issue).issues;
	const customized = new Map<string, ReturnType<typeof formatIssue>["issues"]>();
	return issues.map((entry, index) => {
		const head = entry.path?.[0];
		const required = head === undefined ? undefined : messageAt(requiredMessages, segmentKey(head));
		if (required === undefined) {
			return entry;
		}
		let entries = customized.get(required);
		if (entries === undefined) {
			entries = formatter(required)(issue).issues;
			customized.set(required, entries);
		}
		return entries[index] ?? entry;
	});
}

function segmentKey(segment: PropertyKey | StandardSchema.StandardSchemaV1.PathSegment): string {
	return typeof segment === "object" ? String(segment.key) : String(segment);
}

export function messagesByField(issue: SchemaIssue.Issue, requiredMessages: Readonly<Partial<Record<string, string>>> = noMessages): FieldMessages {
	const messages: Record<string, string> = Object.create(null);
	for (const entry of formattedIssues(issue, requiredMessages)) {
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

export function messageAtPath(
	issue: SchemaIssue.Issue,
	path: readonly PropertyKey[],
	requiredMessages: Readonly<Partial<Record<string, string>>> = noMessages,
): string | undefined {
	for (const entry of formattedIssues(issue, requiredMessages)) {
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

export function messageAt(messages: Readonly<Partial<Record<string, string>>>, name: string): string | undefined {
	return Object.hasOwn(messages, name) ? messages[name] : undefined;
}

export function schemaFeedback<A, E>(
	decoded: Atom.Atom<AsyncResult.AsyncResult<Result.Result<A, SchemaIssue.Issue>, E>>,
	requiredMessages: Readonly<Partial<Record<string, string>>> = noMessages,
) {
	const messages = Atom.map(decoded, (result) =>
		Option.match(AsyncResult.value(result), {
			onNone: () => noMessages,
			onSome: (value) => (Result.isFailure(value) ? messagesByField(value.failure, requiredMessages) : noMessages),
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
					onSome: (value) => (Result.isFailure(value) ? messageAtPath(value.failure, path, requiredMessages) : undefined),
				});
			}),
		field: Atom.family((name: string) => Atom.map(messages, (value) => messageAt(value, name))),
	};
}
