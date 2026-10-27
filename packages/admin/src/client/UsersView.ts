import { Cause, Option, Predicate } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { createElement, useState } from "react";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";
import type { UsersList } from "#users/page.ts";
import type { ChangeRoleInput, UserListInput } from "#users/roles.ts";
import { UsersTable } from "./UsersTable.tsx";

export interface UsersViewProps<TRole extends string> {
	readonly changeRole: Atom.AtomResultFn<ChangeRoleInput<TRole>, void, unknown>;
	readonly list: (input: typeof UserListInput.Type) => Atom.Atom<AsyncResult.AsyncResult<typeof UsersList.Type, unknown>>;
	readonly roles: readonly TRole[];
}

function failure(cause: Cause.Cause<unknown>): string {
	const error = Option.getOrUndefined(Cause.findErrorOption(cause));
	if (Predicate.isTagged(error, "LastRoleAssigner")) {
		return "The last user who can assign roles cannot be removed. Assign another user permission to change roles first.";
	}
	if (Predicate.isTagged(error, "Forbidden")) {
		return "Permission required to assign roles.";
	}
	return "Could not change the role. Try again.";
}

export function UsersView<TRole extends string>({ list, changeRole, roles }: UsersViewProps<TRole>) {
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
		data === undefined ? null : createElement(UsersTable<TRole>, { data, dispatch: action.dispatch, pending: action.pending, roles }),
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
