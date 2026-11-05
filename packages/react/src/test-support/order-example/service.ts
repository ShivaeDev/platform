import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { Identity } from "@shivaedev/identity/identity.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { get } from "./get.ts";
import { list } from "./list.ts";
import { OrdersRepository } from "./repository.ts";
import { save } from "./save.ts";

export const OrderService = defineService({
	id: "@shivaedev/react/order/OrderService",
	initialize: Effect.void,
	methods: () => ({ get, list, save }),
	requires: [Identity, OrdersRepository, SqlClient.SqlClient, Reactivity.Reactivity],
});
