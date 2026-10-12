import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { Activity, act, StrictMode } from "react";
import type { BrowserDraftConfig } from "@shivaedev/effect-form/react.ts";
import { SessionBoundary } from "#session-boundary.ts";
import { render } from "#testing.ts";
import { DraftScreen } from "./DraftScreen.tsx";
import { draftInitial, type Held, type Row, type Save } from "./draftFields.ts";

export async function persistedDraftView(
	persistedDraft: BrowserDraftConfig = { key: "order-draft" },
	save: Save = (values) => Effect.succeed({ ...values, quantity: String(values.quantity) }),
) {
	const query = Atom.make<AsyncResult.AsyncResult<Row>>(AsyncResult.success(draftInitial));
	const held: Held = {};
	function node(session: string | undefined, visible = true, mode: "visible" | "hidden" = "visible") {
		return (
			<StrictMode>
				<Activity mode={mode}>
					<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={session} signedOut="Signed out">
						{() => (visible ? <DraftScreen held={held} persistedDraft={persistedDraft} query={query} save={save} /> : null)}
					</SessionBoundary>
				</Activity>
			</StrictMode>
		);
	}
	const view = await render(node("first"));
	function editor() {
		if (!held.current?.form) {
			throw new Error("Expected an editor form");
		}
		return { ...held.current, form: held.current.form };
	}
	return {
		...view,
		activity: (mode: "visible" | "hidden") => view.render(node("first", true, mode)),
		change: (name: "name" | "quantity", value: string) =>
			act(() => {
				editor().form.change(name, value);
			}),
		editor,
		refresh: (row: Row) =>
			act(() => {
				held.registry?.set(query, AsyncResult.success(row));
			}),
		save: () =>
			act(() => {
				editor().save();
			}),
		show: (session: string | undefined, visible = true) => view.render(node(session, visible)),
	};
}
