import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useMemo } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import type { BrowserClient } from "#client/client.ts";
import { activeRead } from "./activeRead.ts";
import { liveStatus } from "./liveStatus.ts";
import { useMainLocation } from "./MainLocationContext.ts";
import { shellIds } from "./shellIds.ts";

const opening = Atom.make({ failed: false, pending: true });
export function LiveControls({
	client,
	navigationPending,
	navigationFailed,
}: {
	readonly client: Pick<BrowserClient, "api" | "registry"> & { readonly updates: Pick<BrowserClient["updates"], "paused" | "status"> };
	readonly navigationPending: boolean;
	readonly navigationFailed: boolean;
}) {
	const status = useAtomValue(client.updates.status);
	const paused = useAtomValue(client.updates.paused);
	const watcher = useQuery(client.api.watcher.query());
	const observed = Option.getOrUndefined(watcher.data);
	const watching = observed === undefined && Option.isNone(watcher.cause) ? undefined : observed?.watching === true;
	const page = useMainLocation();
	const atom = useMemo(() => (page.route ? activeRead(client.api, page.projection, page.route) : opening), [client, page.projection, page.route]);
	const reading = useAtomValue(atom);
	const displayed = liveStatus({
		connection: status.connection,
		failed: reading.failed,
		navigationFailed,
		paused,
		pending: status.pending,
		waiting: navigationPending || reading.pending,
		watching,
	});
	return (
		<span
			className="font-mono text-muted-foreground text-xs data-[state=down]:text-destructive data-[state=stale]:text-destructive"
			data-state={displayed.state}
			id={shellIds.live}
			role="status"
			title={displayed.title}
		>
			{displayed.text}
		</span>
	);
}
