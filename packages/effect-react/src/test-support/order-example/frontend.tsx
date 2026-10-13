import { type Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { createElement } from "react";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { useEditor } from "#editor.ts";
import { useAction, useQuery } from "#result-state.ts";
import { Orders } from "./contract.ts";
import { Draft } from "./Draft.tsx";
import { DraftFields, valuesOf } from "./fields.ts";

export function makeOrderEditor({
	url,
	token,
	httpClient = FetchHttpClient.layer,
}: {
	readonly url: string;
	readonly token?: string | undefined;
	readonly httpClient?: Layer.Layer<HttpClient.HttpClient>;
}) {
	class Client extends AtomRpc.Service<Client>()("example/OrdersClient", {
		group: Orders,
		protocol: RpcClient.layerProtocolHttp({
			transformClient: (client) =>
				token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
			url,
		}).pipe(Layer.provide([httpClient, RpcSerialization.layerJson])),
	}) {}
	const api = bind(Orders, Client);
	const renameOrder = Client.runtime.fn(api.save.run);

	function Editor({ id }: { readonly id: number }) {
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
	function OrderList({ renameId }: { readonly renameId?: number }) {
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
	return { api, Client, Editor, OrderList };
}
