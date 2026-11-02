import type { Scope } from "effect";
import type { AtomRegistry } from "effect/reactivity/AtomRegistry";
import type { Reactivity } from "effect/reactivity/Reactivity";

export type AtomServices<TRequirements> = TRequirements | Scope.Scope | AtomRegistry | Reactivity;
