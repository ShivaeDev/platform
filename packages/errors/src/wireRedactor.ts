import { Effect, Predicate, Schema, type SchemaAST } from "effect";
import { redactWire } from "#redact.ts";
import { collect, maskedValue, sensitiveEncoding } from "#schemaSensitiveAst.ts";
import { REDACTED, type SensitiveKey } from "#sensitive.ts";
import { wireMask } from "#wireMask.ts";

type Redactor = (value: unknown) => unknown;
type MaskError = Effect.Error<ReturnType<typeof wireMask>>;
interface IndexRedactor {
	readonly accepts: (key: unknown) => boolean;
	readonly apply: Redactor;
	readonly mask: Redactor;
}
function objectRedactor(fields: ReadonlyMap<PropertyKey, Redactor>, indexes: readonly IndexRedactor[], sensitive: SensitiveKey): Redactor {
	function field(key: string): Redactor {
		const property = fields.get(key);
		if (property !== undefined) {
			return property;
		}
		const index = indexes.find((entry) => entry.accepts(key));
		if (index !== undefined) {
			return sensitive(key) ? index.mask : index.apply;
		}
		return (value) => (sensitive(key) ? REDACTED : redactWire(value, sensitive));
	}
	return (value) =>
		Predicate.isObjectOrArray(value)
			? Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, field(key)(nested)]))
			: redactWire(value, sensitive);
}

export const wireRedactor = Effect.fnUntraced(function* (ast: SchemaAST.AST, field: string, sensitive: SensitiveKey, keys: ReadonlySet<string>) {
	const cache = new Map<SchemaAST.AST, Redactor>();
	function constrainedContainer(node: SchemaAST.AST): boolean {
		if (node.checks === undefined) {
			return false;
		}
		const nodes = new Set<SchemaAST.AST>();
		collect(node, nodes);
		return [...nodes].some(
			(child) =>
				child._tag === "Objects" && child.propertySignatures.some((property) => typeof property.name === "string" && sensitive(property.name)),
		);
	}
	function encoded(node: SchemaAST.AST): SchemaAST.AST {
		if (node.encoding !== undefined) {
			return node.encoding.at(-1)?.to ?? node;
		}
		return node._tag === "Declaration" ? Schema.toEncoded(Schema.toCodecJson(Schema.make(node))).ast : node;
	}
	const compileObject = Effect.fnUntraced(function* (node: SchemaAST.Objects, path: string): Effect.fn.Return<Redactor, MaskError> {
		const fields = new Map<PropertyKey, Redactor>();
		for (const property of node.propertySignatures) {
			const stackHeader = property.name === "stack" && (sensitive("message") || sensitive("name"));
			fields.set(
				property.name,
				yield* compile(
					property.type,
					`${path}.${String(property.name)}`,
					stackHeader || (typeof property.name === "string" && sensitive(property.name)),
				),
			);
		}
		const indexes = yield* Effect.forEach(node.indexSignatures, (index) =>
			Effect.gen(function* () {
				const apply = yield* compile(index.type, `${path}[value]`);
				const mask = yield* compile(index.type, `${path}[value]`, true);
				return { accepts: Schema.is(Schema.make(index.parameter)), apply, mask };
			}),
		);
		return objectRedactor(fields, indexes, sensitive);
	});
	const compileArray = Effect.fnUntraced(function* (node: SchemaAST.Arrays, path: string): Effect.fn.Return<Redactor, MaskError> {
		const elements = yield* Effect.forEach(node.elements, (element, index) => compile(element, `${path}[${index}]`));
		const rest = yield* Effect.forEach(node.rest, (element) => compile(element, `${path}[]`));
		return (value) =>
			Array.isArray(value)
				? value.map((item, index) => (elements[index] ?? rest[0] ?? ((entry) => redactWire(entry, sensitive)))(item))
				: redactWire(value, sensitive);
	});
	const compileUnion = Effect.fnUntraced(function* (node: SchemaAST.Union, path: string): Effect.fn.Return<Redactor, MaskError> {
		const members = yield* Effect.forEach(node.types, (member, index) =>
			Effect.map(compile(member, `${path}[${index}]`), (mask) => ({
				accepts: Schema.is(Schema.toEncoded(Schema.toCodecJson(Schema.make(member)))),
				mask,
			})),
		);
		return (value) => {
			const member = members.find(({ accepts }) => accepts(value));
			return member === undefined ? REDACTED : member.mask(value);
		};
	});
	function contents(node: SchemaAST.AST, path: string): Effect.Effect<Redactor, MaskError> {
		switch (node._tag) {
			case "Objects":
				return compileObject(node, path);
			case "Arrays":
				return compileArray(node, path);
			case "Union":
				return compileUnion(node, path);
			case "Suspend":
				return compile(node.thunk(), path);
			default:
				return Effect.succeed((value) => redactWire(value, sensitive));
		}
	}
	function compile(node: SchemaAST.AST, path: string, hidden = false): Effect.Effect<Redactor, MaskError> {
		return Effect.gen(function* () {
			if (
				hidden
				|| constrainedContainer(node)
				|| sensitiveEncoding(node, keys)
				|| (node._tag !== "Union" && maskedValue(node, keys))
				|| Schema.resolveAnnotations(Schema.make(node))?.sensitive === true
			) {
				const mask = yield* wireMask(node, path);
				return () => mask;
			}
			const cached = cache.get(node);
			if (cached !== undefined) {
				return cached;
			}
			let apply: Redactor = () => REDACTED;
			const redactor: Redactor = (value) => apply(value);
			cache.set(node, redactor);
			apply = yield* contents(encoded(node), path);
			return redactor;
		});
	}
	return yield* compile(ast, field);
});
