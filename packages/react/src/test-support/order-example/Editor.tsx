import { type Effect, Option } from "effect";
import { createElement } from "react";
import { useEditor } from "#client/editor.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import { Draft } from "./Draft.tsx";
import { DraftFields, valuesOf } from "./fields.ts";
import type { makeClient } from "./makeClient.ts";

type OrderClient = ReturnType<typeof makeClient>;

export function Editor({ id, client: { api, Client } }: { readonly id: number; readonly client: OrderClient }) {
	const editor = useEditor({
		fields: DraftFields,
		query: api.get.query({ id }),
		rejectField: (error: Effect.Error<ReturnType<typeof api.save.run>>) =>
			error._tag === "OrderValidation" ? { field: error.field, message: error.message } : undefined,
		runtime: Client.runtime,
		save: (values) => api.save.run({ id, ...values }),
		values: valuesOf,
	});
	const { query, form } = editor;
	const order = Option.getOrUndefined(query.data);
	return createElement(
		"section",
		null,
		createElement("h1", null, "Edit order"),
		createElement("button", { disabled: query.pending, onClick: query.refresh, type: "button" }, "Refresh"),
		query.pending && createElement("p", null, "Loading order…"),
		Option.isSome(query.cause) && createElement("p", { role: "alert" }, "Could not load your order. Try again."),
		order && createElement("output", { "data-testid": "server-order" }, `${order.name} / ${order.quantity}`),
		form && createElement(Draft, { form }),
	);
}
export function OrderList({ renameId, client: { api, renameOrder } }: { readonly renameId?: number; readonly client: OrderClient }) {
	const rename = useAction(renameOrder);
	const query = useQuery(api.list.query());
	return createElement(
		"ul",
		{ "data-testid": "order-list" },
		renameId !== undefined
			&& createElement(
				"button",
				{
					"data-action": "rename",
					onClick: () => rename.dispatch({ id: renameId, name: "Office chairs", quantity: 8 }),
					type: "button",
				},
				"Rename order",
			),
		Option.getOrElse(query.data, () => []).map((order) => createElement("li", { key: order.id }, `${order.name} / ${order.quantity}`)),
	);
}
