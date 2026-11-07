import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { Identity } from "@shivaedev/identity/identity.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { BeforeOrderCommit } from "#test/postgres-example/BeforeOrderCommit.ts";
import { get } from "#test/postgres-example/get.ts";
import { OrdersRepository } from "#test/postgres-example/repository.ts";
import { save } from "#test/postgres-example/save.ts";

export const OrderService = defineService({
	id: "@shivaedev/react/postgres-example/OrderService",
	initialize: Effect.void,
	methods: () => ({ get, save }),
	requires: [BeforeOrderCommit, Identity, OrdersRepository, SqlClient.SqlClient, Reactivity.Reactivity],
});
