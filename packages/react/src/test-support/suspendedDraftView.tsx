import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { Activity, act, StrictMode, Suspense, startTransition } from "react";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import type { Rendered } from "#client/testing.ts";
import { DraftScreen } from "./DraftScreen.tsx";
import { DraftSuspender } from "./DraftSuspender.tsx";
import { draftInitial, type Held, type Row } from "./draftFields.ts";

export async function suspendedDraftView(view: Rendered, now: () => number) {
	const query = Atom.make<AsyncResult.AsyncResult<Row>>(AsyncResult.success(draftInitial));
	const held = new Map<string, Held>();
	const pending = Promise.withResolvers<void>();
	const attempts: string[] = [];
	const { container } = view;
	function editor(session = "first") {
		const current = held.get(session)?.current;
		if (!current?.form) {
			throw new Error("Expected an editor form");
		}
		return { ...current, form: current.form };
	}
	async function show(session: string, suspend = false, transition = false, mode: "visible" | "hidden" = "visible") {
		const record = held.get(session) ?? {};
		held.set(session, record);
		const screen = (
			<>
				<DraftScreen
					held={record}
					persistedDraft={{ key: "transition-draft", now }}
					query={query}
					save={(values) => Effect.succeed({ ...values, quantity: String(values.quantity) })}
				/>
				{suspend ? <DraftSuspender attempts={attempts} pending={pending.promise} /> : null}
			</>
		);
		const boundary = (
			<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={session}>
				{() => screen}
			</SessionBoundary>
		);
		const node = (
			<StrictMode>
				<Activity mode={mode}>
					<Suspense fallback="Loading">{boundary}</Suspense>
				</Activity>
			</StrictMode>
		);
		await act(async () => {
			if (transition) {
				startTransition(() => void view.render(node));
			} else {
				void view.render(node);
			}
			await Promise.resolve();
		});
	}
	await show("first");
	return {
		attempts,
		container,
		editor,
		show,
		unmount: view.unmount,
	};
}
