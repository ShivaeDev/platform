import { Option } from "effect";
import { useLayoutEffect } from "react";
import { useAction, useQuery } from "#client/resultState.ts";
import type { SessionClient } from "./client.ts";

export interface Frame {
	readonly busy: boolean;
	readonly completed: boolean;
	readonly name: string;
	readonly verified: boolean;
}
export function SessionView({ client, frames }: { readonly client: SessionClient; readonly frames: Frame[] }) {
	const query = useQuery(client.session.atom);
	const mutation = useAction(client.mutation);
	const session = Option.getOrUndefined(query.data);
	const busy = query.pending;
	const completed = Option.isSome(mutation.data);
	const name = session?.user.name ?? "Signed out";
	const verified = session?.user.emailVerified ?? false;
	useLayoutEffect(() => {
		frames.push({ busy, completed, name, verified });
	}, [busy, completed, frames, name, verified]);
	let status = "Ready";
	if (mutation.pending) {
		status = "Saving";
	} else if (completed) {
		status = "Saved";
	}
	const failure = Option.isSome(query.cause) ? <p role="alert">Session unavailable</p> : null;
	return (
		<section aria-busy={query.pending}>
			<output>{name}</output>
			<span>{verified ? "Verified" : "Unverified"}</span>
			<p>{status}</p>
			{failure}
			<button onClick={() => mutation.dispatch("rename")} type="button">
				Rename
			</button>
			<button onClick={() => mutation.dispatch("verify")} type="button">
				Verify
			</button>
			<button onClick={query.refresh} type="button">
				Refresh
			</button>
		</section>
	);
}
