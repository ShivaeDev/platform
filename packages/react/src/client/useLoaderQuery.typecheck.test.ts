import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { expectTypeOf } from "vitest";
import { useEditor } from "#client/editor.ts";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";

const row = { title: "Loaded note" };
const atom = Atom.make(Effect.succeed(row));

export function useLoadedScreen() {
	const query = useLoaderQuery(atom, row);
	expectTypeOf(query.data).toEqualTypeOf<{ title: string }>();
	const configured = useLoaderQuery(atom, row, {
		coalesceWindow: "100 millis",
		keepPreviousData: true,
		notice: ({ cause, refreshing }) => {
			expectTypeOf(cause).toEqualTypeOf<import("effect").Cause.Cause<never>>();
			expectTypeOf(refreshing).toEqualTypeOf<boolean>();
			return undefined;
		},
	});
	expectTypeOf(configured).toEqualTypeOf<typeof query>();
	// @ts-expect-error The loaded accessor exposes no Initial result.
	expectTypeOf(query.result);
	// @ts-expect-error A route must supply its loader's success value.
	useLoaderQuery(atom);
	// @ts-expect-error The loader value must match the query's success type.
	useLoaderQuery(atom, { id: 1 });
	const editor = useEditor({
		fields: Schema.Struct({ title: Schema.String }),
		loaded: row,
		query: atom,
		runtime: Atom.runtime(Layer.empty),
		save: Effect.succeed,
		values: (value) => value,
	});
	expectTypeOf(editor.query.data).toEqualTypeOf<{ title: string }>();
	expectTypeOf<undefined>().not.toExtend<typeof editor.form>();
	return { editor, query };
}
