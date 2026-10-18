import { Effect } from "effect";
import { act } from "react";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { Rendered } from "#client/testing.ts";
import { CreateDraftProbe, DirectDraftProbe } from "./CreateDraftProbe.tsx";
import type { CreateEffect, CreateHeld } from "./createDraftFields.ts";
import { submitForm, typeInput } from "./Screen.ts";

export async function persistedCreateView(view: Rendered, create: CreateEffect = Effect.succeed, direct = false) {
	const held: CreateHeld = {};
	function node(session = "first") {
		return (
			<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={session}>
				{() => (direct ? <DirectDraftProbe create={create} held={held} /> : <CreateDraftProbe create={create} held={held} />)}
			</SessionBoundary>
		);
	}
	await view.render(node());
	function form() {
		if (!held.form) {
			throw new Error("Expected a form");
		}
		return held.form;
	}
	return {
		...view,
		change: (value: string) =>
			act(() => {
				typeInput(view.container, "name", value);
			}),
		form,
		save: () =>
			act(() => {
				submitForm(view.container);
			}),
		saving: () => held.created?.saving ?? false,
		show: (session: string) => view.render(node(session)),
	};
}
