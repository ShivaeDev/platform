import { bind } from "@shivaedev/effect-contract";
import { make } from "@shivaedev/effect-form";
import { useDirty, useField, useSubmit } from "@shivaedev/effect-form/react";
import { Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { createElement, useEffect, useState } from "react";
import { useQuery } from "../../src/index.ts";
import { Order, Orders } from "./contract.ts";

const fields = Schema.Struct({
	name: Order.fields.name,
	quantity: Schema.NumberFromString,
});

const valuesOf = (order: Order) => ({
	name: order.name,
	quantity: String(order.quantity),
});

const saveStatus = (submitting: boolean, dirty: boolean): string => {
	if (submitting) return "Saving…";
	return dirty ? "Unsaved changes" : "Saved";
};

export const makeOrderEditor = ({ url, token }: { readonly url: string; readonly token?: string | undefined }) => {
	class Client extends AtomRpc.Service<Client>()("example/OrdersClient", {
		group: Orders,
		protocol: RpcClient.layerProtocolHttp({
			url,
			transformClient: (client) =>
				token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
		}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
	}) {}
	const api = bind(Orders, Client);

	const Draft = ({ order }: { readonly order: Order }) => {
		const [form] = useState(() =>
			make(fields, {
				initialValues: valuesOf(order),
				runtime: Client.runtime,
				onSubmit: (values, submitter) =>
					api.save.run({ id: order.id, ...values }).pipe(Effect.catchTag("OrderValidation", (error) => submitter.fail(error.field, error.message))),
			}),
		);
		useEffect(() => form.receive(valuesOf(order)), [form, order]);
		const name = useField(form, "name");
		const quantity = useField(form, "quantity");
		const submit = useSubmit(form);
		useEffect(() => {
			if (AsyncResult.isSuccess(submit.result) && !submit.result.waiting) {
				form.receive(valuesOf(submit.result.value));
			}
		}, [form, submit.result]);
		const dirty = useDirty(form);
		const failure = Option.getOrUndefined(AsyncResult.error(submit.result));
		const generalFailure = failure !== undefined && failure._tag !== "FieldFailure" && failure._tag !== "Invalid";
		return createElement(
			"form",
			{
				onSubmit: (event) => {
					event.preventDefault();
					if (!submit.submitting) submit.run();
				},
			},
			createElement(
				"label",
				null,
				"Name",
				createElement("input", {
					name: name.name,
					value: name.value,
					"aria-invalid": name.error !== undefined,
					"aria-describedby": name.error ? "order-name-error" : undefined,
					onBlur: name.onBlur,
					onChange: (event) => name.onChange(event.target.value),
				}),
			),
			name.error && createElement("p", { role: "alert", id: "order-name-error" }, name.error),
			createElement(
				"label",
				null,
				"Quantity",
				createElement("input", {
					name: quantity.name,
					inputMode: "decimal",
					value: quantity.value,
					"aria-invalid": quantity.error !== undefined,
					"aria-describedby": quantity.error ? "order-quantity-error" : undefined,
					onBlur: quantity.onBlur,
					onChange: (event) => quantity.onChange(event.target.value),
				}),
			),
			quantity.error && createElement("p", { role: "alert", id: "order-quantity-error" }, quantity.error),
			generalFailure && createElement("p", { role: "alert" }, "Could not save your order. Try again."),
			createElement("button", { type: "submit", disabled: submit.submitting }, "Save"),
			createElement("button", { type: "button", onClick: form.revert, disabled: submit.submitting }, "Revert"),
			createElement("p", { role: "status" }, saveStatus(submit.submitting, dirty)),
		);
	};

	const Editor = ({ id }: { readonly id: number }) => {
		const query = useQuery(api.get.query({ id }));
		const order = Option.getOrUndefined(query.data);
		return createElement(
			"section",
			null,
			createElement("h1", null, "Edit order"),
			createElement("button", { type: "button", onClick: query.refresh, disabled: query.pending }, "Refresh"),
			query.pending && createElement("p", null, "Loading order…"),
			Option.isSome(query.cause) && createElement("p", { role: "alert" }, "Could not load your order. Try again."),
			order && createElement("output", { "data-testid": "server-order" }, `${order.name} / ${order.quantity}`),
			order && createElement(Draft, { key: order.id, order }),
		);
	};
	const OrderList = () => {
		const query = useQuery(api.list.query());
		return createElement(
			"ul",
			{ "data-testid": "order-list" },
			Option.getOrElse(query.data, () => []).map((order) => createElement("li", { key: order.id }, `${order.name} / ${order.quantity}`)),
		);
	};
	return { Client, api, Editor, OrderList };
};
