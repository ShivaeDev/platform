import { RegistryContext } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useState } from "react";
import type { ClientConnection } from "#client/Module.ts";

export function useAnonymousConnection(connection: ClientConnection) {
	const registry = useContext(RegistryContext);
	const [client] = useState(() =>
		Effect.runSync(connection({ id: "anonymous" }, registry).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry))),
	);
	return client;
}
