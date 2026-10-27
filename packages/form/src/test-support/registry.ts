import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

export const registry = Effect.acquireRelease(
	Effect.sync(() => AtomRegistry.make()),
	(current) => Effect.sync(() => current.dispose()),
);
