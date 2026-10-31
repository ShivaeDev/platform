import { Cause, type Effect, Option, Predicate } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { createElement, useState } from "react";
import type { SessionList, SessionListInput, SignedInSession } from "@shivaedev/identity/sessions.ts";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";
import type { AtomServices } from "@shivaedev/react/fieldRejection.ts";
import { SessionConfirmation } from "./SessionConfirmation.tsx";
import { SessionListView } from "./SessionListView.tsx";
import { SessionPagination } from "./SessionPagination.tsx";

export interface SessionsViewProps<R, E> {
	readonly currentSessionId: string | undefined;
	readonly list: (input: typeof SessionListInput.Type) => Atom.Atom<AsyncResult.AsyncResult<typeof SessionList.Type, unknown>>;
	readonly onCurrentSessionRevoked: () => void;
	readonly revoke: (input: { readonly id: string }) => Effect.Effect<void, unknown, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<R, E>;
}

function forbidden(cause: Option.Option<Cause.Cause<unknown>>) {
	return Option.exists(Option.flatMap(cause, Cause.findErrorOption), (error) => Predicate.isTagged(error, "Forbidden"));
}

export function SessionsView<R, E>({ currentSessionId, list, onCurrentSessionRevoked, revoke, runtime }: SessionsViewProps<R, E>) {
	const [cursors, setCursors] = useState<readonly NonNullable<typeof SessionListInput.Type.cursor>[]>([]);
	const [selected, select] = useState<typeof SignedInSession.Type>();
	const cursor = cursors.at(-1);
	const state = useQuery(list({ ...(cursor === undefined ? {} : { cursor }), limit: 20 }));
	const action = useAction(runtime, revoke, {
		onSuccess: (_, { id }) => {
			select(undefined);
			if (id === currentSessionId) {
				onCurrentSessionRevoked();
			}
		},
	});
	if (forbidden(state.cause)) {
		return createElement("p", { role: "alert" }, "Permission required to manage sessions.");
	}
	const data = Option.getOrUndefined(state.data);
	return createElement(
		"section",
		{ "aria-label": "Signed-in sessions", className: "min-w-0 space-y-4" },
		createElement(
			"button",
			{
				className: "rounded-md border px-3 py-2 disabled:opacity-50",
				disabled: state.pending || action.pending,
				onClick: state.refresh,
				type: "button",
			},
			"Refresh sessions",
		),
		state.pending ? createElement("p", { role: "status" }, "Loading sessions…") : null,
		Option.isSome(state.cause) ? createElement("p", { role: "alert" }, "Could not load sessions. Try refreshing.") : null,
		Option.isSome(action.cause) ? createElement("p", { role: "alert" }, "Could not revoke the session. Refresh and try again.") : null,
		createElement(SessionConfirmation, {
			currentSessionId,
			onCancel: () => select(undefined),
			onConfirm: action.dispatch,
			pending: action.pending,
			selected,
		}),
		data === undefined ? null : createElement(SessionListView, { currentSessionId, pending: action.pending, select, sessions: data.sessions }),
		createElement(SessionPagination, {
			cursors,
			data,
			go: (next) => {
				select(undefined);
				setCursors(next);
			},
			pending: state.pending || action.pending,
		}),
	);
}
