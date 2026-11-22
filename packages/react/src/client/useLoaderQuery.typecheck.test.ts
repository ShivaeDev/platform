import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { expectTypeOf } from "vitest";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { type LoadedRow, queryRoute } from "#client/adapters/queryRoute.ts";
import { useEditor } from "#client/editor.ts";
import { useLoaderQuery } from "#client/useLoaderQuery.ts";

class SubtitleRejected extends Schema.TaggedError<SubtitleRejected>()("SubtitleRejected", { message: Schema.String }) {}

const row = { title: "Loaded note" };
const atom = Atom.make(Effect.succeed(row));
const shared = Atom.make(Effect.fail(new Conflict({ message: "Changed elsewhere" })).pipe(Effect.as(row)));
const declared = Atom.make(Effect.fail(new SubtitleRejected({ message: "Too long" })).pipe(Effect.as(row)));
const save = { run: (values: { readonly title: string }) => Effect.succeed(values), runtime: Atom.runtime(Layer.empty) };
const Fields = Schema.Struct({ title: Schema.String });

function subtitleNotice(error: SubtitleRejected) {
	return { message: error.message };
}

export function useLoadedScreen() {
	const query = useLoaderQuery(atom, row);
	expectTypeOf(query.data).toEqualTypeOf<{ title: string }>();
	const configured = useLoaderQuery(atom, row, { keepPreviousData: true });
	expectTypeOf(configured).toEqualTypeOf<typeof query>();
	// @ts-expect-error The loaded accessor exposes no Initial result.
	expectTypeOf(query.result);
	// @ts-expect-error A route must supply its loader's success value.
	useLoaderQuery(atom);
	// @ts-expect-error The loader value must match the query's success type.
	useLoaderQuery(atom, { id: 1 });
	const editor = useEditor(save, { fields: Fields, loaded: row, query: atom });
	expectTypeOf(editor.query.data).toEqualTypeOf<{ title: string }>();
	expectTypeOf<undefined>().not.toExtend<typeof editor.form>();
	return { editor, query };
}

// A shared rejection has its default notice, so it needs no handler; a rejection the app declared does, on the loaded query and the loaded editor.
export function useLoadedFailures() {
	useLoaderQuery(shared, row);
	// @ts-expect-error The query can fail with SubtitleRejected, which the app declared: the call must say what its notice shows.
	useLoaderQuery(declared, row);
	// @ts-expect-error Options without `failures` leave SubtitleRejected unshown.
	useLoaderQuery(declared, row, { keepPreviousData: true });
	// @ts-expect-error `failures` must name SubtitleRejected.
	useLoaderQuery(declared, row, { failures: {} });
	useLoaderQuery(declared, row, { failures: { SubtitleRejected: subtitleNotice } });
	useLoaderQuery(declared, row, { failures: { SubtitleRejected: "message" } });
	useEditor(save, { fields: Fields, loaded: row, query: shared });
	// @ts-expect-error The loaded editor's query can fail with SubtitleRejected: `queryFailures` must say what its notice shows.
	useEditor(save, { fields: Fields, loaded: row, query: declared });
	useEditor(save, { fields: Fields, loaded: row, query: declared, queryFailures: { SubtitleRejected: "silent" } });
	const route = queryRoute(() => declared, { failures: { SubtitleRejected: subtitleNotice } });
	useEditor(save, { fields: Fields, ...route.useLoaded() });
	useEditor(save, { fields: Fields, ...route.useLoaded(), queryFailures: { SubtitleRejected: "silent" } });
	const loadedRow: LoadedRow<typeof declared> = route.useLoaded();
	useEditor(save, { fields: Fields, ...loadedRow });
	expectTypeOf({ loaded: row, query: declared, queryFailures: {} }).not.toExtend<LoadedRow<typeof declared>>();
	// An editor that loads its own row shows its query's failures through QueryView, which checks them.
	useEditor(save, { fields: Fields, query: declared });
}
