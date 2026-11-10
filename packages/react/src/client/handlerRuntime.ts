import * as Atom from "effect/reactivity/Atom";
import { clientCrypto } from "#client/crypto.ts";

export const handlerRuntime = Atom.runtime(clientCrypto);
