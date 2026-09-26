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
import { Meal, Meals } from "./contract.ts";

const fields = Schema.Struct({
	name: Meal.fields.name,
	calories: Schema.NumberFromString,
});

const valuesOf = (meal: Meal) => ({
	name: meal.name,
	calories: String(meal.calories),
});

const saveStatus = (submitting: boolean, dirty: boolean): string => {
	if (submitting) return "Saving…";
	return dirty ? "Unsaved changes" : "Saved";
};

export const makeMealEditor = ({ url, token }: { readonly url: string; readonly token?: string | undefined }) => {
	class Client extends AtomRpc.Service<Client>()("example/MealsClient", {
		group: Meals,
		protocol: RpcClient.layerProtocolHttp({
			url,
			transformClient: (client) =>
				token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
		}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
	}) {}
	const api = bind(Meals, Client);

	const Draft = ({ meal }: { readonly meal: Meal }) => {
		const [form] = useState(() =>
			make(fields, {
				initialValues: valuesOf(meal),
				runtime: Client.runtime,
				onSubmit: (values, submitter) =>
					api.save.run({ id: meal.id, ...values }).pipe(Effect.catchTag("MealValidation", (error) => submitter.fail(error.field, error.message))),
			}),
		);
		useEffect(() => form.receive(valuesOf(meal)), [form, meal]);
		const name = useField(form, "name");
		const calories = useField(form, "calories");
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
					"aria-describedby": name.error ? "meal-name-error" : undefined,
					onBlur: name.onBlur,
					onChange: (event) => name.onChange(event.target.value),
				}),
			),
			name.error && createElement("p", { role: "alert", id: "meal-name-error" }, name.error),
			createElement(
				"label",
				null,
				"Calories",
				createElement("input", {
					name: calories.name,
					inputMode: "decimal",
					value: calories.value,
					"aria-invalid": calories.error !== undefined,
					"aria-describedby": calories.error ? "meal-calories-error" : undefined,
					onBlur: calories.onBlur,
					onChange: (event) => calories.onChange(event.target.value),
				}),
			),
			calories.error && createElement("p", { role: "alert", id: "meal-calories-error" }, calories.error),
			generalFailure && createElement("p", { role: "alert" }, "Could not save your meal. Try again."),
			createElement("button", { type: "submit", disabled: submit.submitting }, "Save"),
			createElement("button", { type: "button", onClick: form.revert, disabled: submit.submitting }, "Revert"),
			createElement("p", { role: "status" }, saveStatus(submit.submitting, dirty)),
		);
	};

	const Editor = ({ id }: { readonly id: number }) => {
		const query = useQuery(api.get.query({ id }));
		const meal = Option.getOrUndefined(query.data);
		return createElement(
			"section",
			null,
			createElement("h1", null, "Edit meal"),
			createElement("button", { type: "button", onClick: query.refresh, disabled: query.pending }, "Refresh"),
			query.pending && createElement("p", null, "Loading meal…"),
			Option.isSome(query.cause) && createElement("p", { role: "alert" }, "Could not load your meal. Try again."),
			meal && createElement("output", { "data-testid": "server-meal" }, `${meal.name} / ${meal.calories}`),
			meal && createElement(Draft, { key: meal.id, meal }),
		);
	};
	const MealList = () => {
		const query = useQuery(api.list.query());
		return createElement(
			"ul",
			{ "data-testid": "meal-list" },
			Option.getOrElse(query.data, () => []).map((meal) => createElement("li", { key: meal.id }, `${meal.name} / ${meal.calories}`)),
		);
	};
	return { Client, api, Editor, MealList };
};
