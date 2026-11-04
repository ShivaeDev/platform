import { Effect, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";

export class SessionGuard extends RpcMiddleware.Service<SessionGuard>()("@shivaedev/react/test/SessionReconnectGuard", { error: Unauthorized }) {}
const accounts = collection("reconnect-account", Schema.String);
export const Accounts = contract("reconnectAccounts", {
	queries: [
		query("get", {
			payload: { page: Schema.String },
			readPolicy: () => Effect.succeed(true),
			reads: () => [accounts.list],
			success: Schema.String,
		}),
	],
}).middleware(SessionGuard);
