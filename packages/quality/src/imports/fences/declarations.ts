import { Schema } from "effect";
import { decodeWith } from "#decoded.ts";
import type { Fence, Selector } from "./model.ts";

const SelectorInput: Schema.Codec<Selector> = Schema.suspend(() =>
	Schema.Union([
		Schema.Struct({ kind: Schema.Literal("anything") }),
		Schema.Struct({ kind: Schema.Literal("workspace") }),
		Schema.Struct({ kind: Schema.Literal("anyOf"), members: Schema.Array(SelectorInput) }),
		Schema.Struct({ base: SelectorInput, excluded: Schema.Array(SelectorInput), kind: Schema.Literal("except") }),
		Schema.Struct({ kind: Schema.Literals(["files", "folders"]), paths: Schema.Array(Schema.String) }),
		Schema.Struct({ kind: Schema.Literals(["modules", "packages", "scopes"]), names: Schema.Array(Schema.String) }),
	]),
);

const ExampleStep = Schema.Union([Schema.String, Schema.Struct({ external: Schema.String })]);

const Chain = Schema.TupleWithRest(Schema.Tuple([Schema.String, ExampleStep]), [ExampleStep]);

const FenceInput: Schema.Codec<Fence> = Schema.Struct({
	_tag: Schema.Literal("Fence"),
	examples: Schema.Struct({ illegal: Chain, legal: Chain }),
	from: SelectorInput,
	name: Schema.String,
	prohibition: Schema.Union([
		Schema.Struct({ kind: Schema.Literals(["import", "reach"]), to: SelectorInput }),
		Schema.Struct({ kind: Schema.Literal("vocabulary"), subjects: Schema.Array(Schema.String), unit: SelectorInput }),
	]),
	rationale: Schema.String,
});

export const Declarations = Schema.Array(FenceInput);

export function decodeDeclarations(value: unknown) {
	return decodeWith(Declarations, value);
}
