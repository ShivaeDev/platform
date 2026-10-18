import type { Cause } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { pageQueries } from "./pageQueries.ts";
import { resolvedDocumentFailure } from "./resolvedDocumentFailure.ts";
import type { ShellApi } from "./ShellApi.ts";

function health(value: { readonly _tag: string; readonly waiting: boolean; readonly cause?: Cause.Cause<unknown> }) {
	return {
		failed: value._tag === "Failure" && !(value.cause && resolvedDocumentFailure(value.cause)),
		pending: value.waiting || value._tag === "Initial",
	};
}
export function activeRead(api: ShellApi, kind: string, url: string) {
	const queries = pageQueries(api, kind, url);
	return Atom.make((get) => {
		const readings = queries.map((query) => health(get(query)));
		return { failed: readings.some((reading) => reading.failed), pending: readings.some((reading) => reading.pending) };
	});
}
