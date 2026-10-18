import { Option } from "effect";
import { createElement } from "react";
import { useAction, useQuery } from "#result-state.ts";
import { NotesClient } from "./NotesClient.ts";

const list = NotesClient.query("ListNotes", undefined, {
	reactivityKeys: ["notes"],
});
const create = NotesClient.mutation("CreateNote");
export function NativeNotesView() {
	const query = useQuery(list);
	const action = useAction(create);
	return createElement(
		"section",
		null,
		createElement(
			"output",
			null,
			JSON.stringify({
				error: Option.isSome(action.cause),
				loading: query.pending,
				saving: action.pending,
				titles: Option.getOrElse(query.data, () => []).map((note) => note.title),
			}),
		),
		createElement(
			"button",
			{
				onClick: () =>
					action.dispatch({
						payload: { title: "Morning walk" },
						reactivityKeys: ["notes"],
					}),
				type: "button",
			},
			"Save",
		),
		createElement(
			"button",
			{
				onClick: () =>
					action.dispatch({
						payload: { title: "" },
						reactivityKeys: ["notes"],
					}),
				type: "button",
			},
			"Save empty",
		),
	);
}
