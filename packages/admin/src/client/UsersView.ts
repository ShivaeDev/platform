import { Cause, Option, Predicate } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { createElement, useState } from "react";
import { useAction, useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { ChangeRoleInput, UserListInput } from "@shivaedev/platform/rpc/userRoles.ts";
import type { UsersList } from "#users/page.ts";
import { UsersTable } from "./UsersTable.tsx";

export interface UsersViewProps {
	readonly changeRole: Atom.AtomResultFn<typeof ChangeRoleInput.Type, void, unknown>;
	readonly list: (input: typeof UserListInput.Type) => Atom.Atom<AsyncResult.AsyncResult<typeof UsersList.Type, unknown>>;
}

function failure(cause: Cause.Cause<unknown>): string {
	const error = Option.getOrUndefined(Cause.findErrorOption(cause));
	if (Predicate.isTagged(error, "LastOwner")) {
		return "The last owner cannot be demoted. Grant owner to another user first.";
	}
	if (Predicate.isTagged(error, "Forbidden")) {
		return "Owner role required to change roles.";
	}
	return "Could not change the role. Try again.";
}

export function UsersView({ list, changeRole }: UsersViewProps) {
	const [cursors, setCursors] = useState<readonly string[]>([]);
	const cursor = cursors.at(-1);
	const state = useQuery(list({ ...(cursor === undefined ? {} : { cursor }), limit: 20 }));
	const action = useAction(changeRole);
	const data = Option.getOrUndefined(state.data);
	return createElement(
		"section",
		{ "aria-label": "App users", className: "space-y-4" },
		createElement(
			"button",
			{ className: "rounded-md border px-3 py-2 disabled:opacity-50", disabled: state.pending, onClick: state.refresh, type: "button" },
			"Refresh users",
		),
		state.pending ? createElement("p", { role: "status" }, "Loading users…") : null,
		Option.isSome(state.cause) ? createElement("p", { role: "alert" }, "Could not load users. Try refreshing.") : null,
		Option.isSome(action.cause) ? createElement("p", { role: "alert" }, failure(action.cause.value)) : null,
		data === undefined ? null : createElement(UsersTable, { data, dispatch: action.dispatch, pending: action.pending }),
		data === undefined
			? null
			: createElement(
					"nav",
					{ "aria-label": "User pages", className: "flex gap-4" },
					createElement(
						"button",
						{
							className: "rounded-md border px-3 py-2 disabled:opacity-50",
							disabled: cursors.length === 0 || state.pending,
							onClick: () => setCursors(cursors.slice(0, -1)),
							type: "button",
						},
						"Previous users",
					),
					createElement(
						"button",
						{
							className: "rounded-md border px-3 py-2 disabled:opacity-50",
							disabled: Option.isNone(data.next) || state.pending,
							onClick: () => Option.map(data.next, (next) => setCursors([...cursors, next])),
							type: "button",
						},
						"Next users",
					),
				),
	);
}
