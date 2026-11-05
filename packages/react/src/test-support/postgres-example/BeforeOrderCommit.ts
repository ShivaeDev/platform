import { Context, type Effect } from "effect";
import type { Rejected } from "./contract.ts";

export class BeforeOrderCommit extends Context.Service<BeforeOrderCommit, Effect.Effect<void, Rejected>>()(
	"@shivaedev/react/postgres-example/BeforeOrderCommit",
) {}
