import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { Identity } from "@shivaedev/identity/identity.ts";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { get } from "#test/order-example/get.ts";
import { list } from "#test/order-example/list.ts";
import { OrdersRepository } from "#test/order-example/repository.ts";
import { save } from "#test/order-example/save.ts";

export const OrderService = defineService({
	id: "@shivaedev/react/order/OrderService",
	initialize: Effect.void,
	methods: () => ({ get, list, save }),
	requires: [Identity, OrdersRepository, SqlClient.SqlClient, Reactivity.Reactivity],
});
