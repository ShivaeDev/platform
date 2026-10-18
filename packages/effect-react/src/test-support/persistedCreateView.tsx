import { Effect } from "effect";
import { act } from "react";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { render } from "#client/testing.ts";
import { CreateDraftProbe, DirectDraftProbe } from "./CreateDraftProbe.tsx";
import type { CreateEffect, CreateHeld } from "./createDraftFields.ts";

export async function persistedCreateView(create: CreateEffect = Effect.succeed, direct = false) {
	const held: CreateHeld = {};
	function node(session = "first") {
		return (
			<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={session}>
				{() => (direct ? <DirectDraftProbe create={create} held={held} /> : <CreateDraftProbe create={create} held={held} />)}
			</SessionBoundary>
		);
	}
	const view = await render(node());
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
				form().change("name", value);
			}),
		form,
		save: () =>
			act(() => {
				held.created?.save();
			}),
		saving: () => held.created?.saving ?? false,
		show: (session: string) => view.render(node(session)),
	};
}
