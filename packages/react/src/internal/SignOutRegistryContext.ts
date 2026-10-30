import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createContext } from "react";

export const SignOutRegistryContext = createContext<AtomRegistry.AtomRegistry | undefined>(undefined);
