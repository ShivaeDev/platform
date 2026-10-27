import { Context, Effect } from "effect";

export const ChangeDeclarations = Context.Reference<{
	declare: (table: string, keys: readonly string[], rows: number) => Effect.Effect<void>;
}>("@shivaedev/sql/ChangeDeclarations", { defaultValue: () => ({ declare: () => Effect.void }) });
