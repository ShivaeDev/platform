import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { Activity, act, StrictMode } from "react";
import type { BrowserDraftConfig } from "@shivaedev/form/client/react.ts";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { DraftScreen } from "./DraftScreen.tsx";
import { draftInitial, type Held, type Row, type Save } from "./draftFields.ts";
import { submitForm, typeInput } from "./Screen.ts";

export async function persistedDraftView(
	view: Rendered,
	persistedDraft: BrowserDraftConfig,
	save: Save = (values) => Effect.succeed({ ...values, quantity: String(values.quantity) }),
	session = "first",
) {
	const query = Atom.make<AsyncResult.AsyncResult<Row>>(AsyncResult.success(draftInitial));
	const held: Held = {};
	function node(shownSession: string | undefined, visible = true, mode: "visible" | "hidden" = "visible") {
		return (
			<StrictMode>
				<Activity mode={mode}>
					<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={shownSession} signedOut="Signed out">
						{() => (visible ? <DraftScreen held={held} persistedDraft={persistedDraft} query={query} save={save} /> : null)}
					</SessionBoundary>
				</Activity>
			</StrictMode>
		);
	}
	await view.render(node(session));
	function editor() {
		if (!held.current?.form) {
			throw new Error("Expected an editor form");
		}
		return { ...held.current, form: held.current.form };
	}
	return {
		...view,
		activity: (mode: "visible" | "hidden") => view.render(node(session, true, mode)),
		change: (name: "name" | "quantity", value: string) =>
			act(() => {
				typeInput(view.container, name, value);
			}),
		editor,
		refresh: (row: Row) =>
			act(() => {
				if (!held.registry) {
					throw new Error("Expected a captured draft registry");
				}
				held.registry.set(query, AsyncResult.success(row));
			}),
		save: () =>
			act(() => {
				submitForm(view.container);
			}),
		show: (shownSession: string | undefined, visible = true) => view.render(node(shownSession, visible)),
	};
}
