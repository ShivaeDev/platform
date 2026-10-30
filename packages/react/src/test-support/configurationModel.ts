import { Context, Data, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { Create } from "#client/create.ts";
import type { LoadedEditor } from "#client/editor.ts";

export class Destination extends Context.Service<Destination, string>()("configuration/Destination") {}
export class Rejected extends Data.TaggedError("Rejected")<{ readonly field: "name"; readonly message: string }> {}
export const Name = Schema.Struct({ name: Schema.String });
export const NormalizedName = Schema.Struct({ name: Schema.Trim });
export const firstRuntime = Atom.runtime(Layer.succeed(Destination, "first"));
export const secondRuntime = Atom.runtime(Layer.succeed(Destination, "second"));
export type Name = typeof Name.Type;
export type Current = Create<typeof Name.fields, Name, Rejected, never> | LoadedEditor<typeof Name.fields, Name, never, Rejected, never>;
export interface ConfigurationProps {
	readonly completion: PromiseWithResolvers<void>;
	readonly fields: typeof Name;
	readonly held: { current?: Current };
	readonly kind: "create" | "editor";
	readonly mapping: boolean;
	readonly now: () => number;
	readonly pending: boolean;
	readonly rejected: boolean;
	readonly revision: string;
	readonly runtime: typeof firstRuntime;
	readonly saved: string[];
}
