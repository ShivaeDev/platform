import { Effect } from "effect";
import { act } from "react";
import type { draftPersistence } from "@shivaedev/form/adapters/draftPersistence.ts";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { CreateDraftProbe, DirectDraftProbe } from "./CreateDraftProbe.tsx";
import type { CreateEffect, CreateHeld } from "./createDraftFields.ts";

export async function persistedCreateView(
	view: Rendered,
	persistence: Effect.Success<typeof draftPersistence>,
	create: CreateEffect = Effect.succeed,
	direct = false,
) {
	const held: CreateHeld = {};
	function node(session = "first") {
		return (
			<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={session}>
				{() =>
					direct ? (
						<DirectDraftProbe create={create} held={held} persistence={persistence} />
					) : (
						<CreateDraftProbe create={create} held={held} persistence={persistence} />
					)
				}
			</SessionBoundary>
		);
	}
	const driver = screenDriver({ root: view.container, tell: () => undefined });
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
			act(async () => {
				await Effect.runPromise(driver.enter('input[name="name"]', value));
			}),
		form,
		save: () =>
			act(async () => {
				await Effect.runPromise(driver.submit());
			}),
		saving: () => held.created?.saving ?? false,
		show: (session: string) => view.render(node(session)),
	};
}
