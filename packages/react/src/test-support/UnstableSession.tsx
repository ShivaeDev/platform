import { type ReactNode, useState } from "react";
import { SessionBoundary } from "#client/sessionBoundary.ts";

export function UnstableSession({ children, onRecheck }: { readonly children?: ReactNode; readonly onRecheck: (generation: number) => void }) {
	const [generation, change] = useState(0);
	return (
		<SessionBoundary
			connect={() => undefined}
			identify={(session: string) => session}
			recheck={() => {
				onRecheck(generation);
				change(generation + 1);
			}}
			session="session"
		>
			{() => children}
		</SessionBoundary>
	);
}
