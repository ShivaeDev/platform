import * as Atom from "effect/reactivity/Atom";
import { clientCrypto } from "#client/adapters/crypto.ts";

export const handlerRuntime = Atom.runtime(clientCrypto);
