import { Context, Effect, Option, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";

export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", {}) {}
export class Access extends Context.Service<
	Access,
	{
		allowed: boolean;
		checks: number;
		rejection: "denied" | "NotFound" | "Rejected";
	}
>()("@shivaedev/contract/test/DeniedAccess") {}
export class Guard extends RpcMiddleware.Service<Guard>()("@shivaedev/contract/test/DeniedGuard", {
	error: Schema.Union([MissingReadPolicy, QueryReadDenied]),
}) {}
export const records = collection("denied-records", Schema.Number);
const policy = Effect.fnUntraced(function* (_payload: unknown, viewer: Option.Option<{ readonly id: string }>) {
	const access = yield* Access;
	access.checks += 1;
	if (access.rejection === "NotFound") {
		return yield* new NotFound({ message: "Record not found" });
	}
	if (access.rejection === "Rejected") {
		return yield* new Rejected();
	}
	return access.allowed || Option.isSome(viewer);
});
const declaration = { readPolicy: policy, rejections: { NotFound, Rejected }, success: Schema.String };
export const Records = contract("denied-records", {
	commands: [command("touch", { invalidates: () => [records.item(1)] })],
	queries: [query("pushed", { ...declaration, reads: () => [records.item(1)] }), query("unkeyed", declaration)],
}).middleware(Guard);
