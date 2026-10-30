import { Context, Effect, type Layer } from "effect";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";

class Database extends Context.Service<Database, boolean>()("test/Database") {}
const Read = query("read", { readPolicy: () => Database, reads: () => [] });
const Reads = contract("reads", { queries: [Read] });
const handlers: Layer.Layer<Layer.Success<ReturnType<typeof Reads.application.toLayer>>> = Reads.application.toLayer({
	"reads.read": () => Effect.void,
});
void handlers;
