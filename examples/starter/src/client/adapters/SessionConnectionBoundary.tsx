import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { SessionBoundary, type SessionBoundaryProps } from "@shivaedev/react/client/sessionBoundary.ts";
import type { AppConnection, ClientConnection } from "#client/Module.ts";

type Props = Omit<SessionBoundaryProps<{ readonly id: string }, AppConnection>, "connect"> & { readonly connect: ClientConnection };

export function SessionConnectionBoundary({ connect, ...props }: Props) {
	return (
		<SessionBoundary
			{...props}
			connect={(session, registry) => Effect.runSync(connect(session, registry).pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)))}
		/>
	);
}
