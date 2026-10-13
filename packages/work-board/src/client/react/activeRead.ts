import type { Cause } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { BrowserClient } from "#client/client.ts";
import { resolvedDocumentFailure } from "#client/page/resolvedDocumentFailure.ts";
import { pageQuery } from "./pageQuery.ts";

function health(value: { readonly _tag: string; readonly waiting: boolean; readonly cause?: Cause.Cause<unknown> }) {
	return {
		failed: value._tag === "Failure" && !(value.cause && resolvedDocumentFailure(value.cause)),
		pending: value.waiting || value._tag === "Initial",
	};
}
export function activeRead(client: BrowserClient, kind: string, url: string, baseline: string | null) {
	return pageQuery(client.api, kind, url, baseline).pipe(Atom.map(health));
}
