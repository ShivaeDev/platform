import type { BrowserClient } from "#client/client.ts";
import { LiveControls } from "./LiveControls.tsx";
import { shellIds } from "./shellIds.ts";

export function ShellLiveStatus({
	client,
	failed,
	pending,
}: {
	readonly client: BrowserClient | undefined;
	readonly failed: boolean;
	readonly pending: boolean;
}) {
	return client ? (
		<LiveControls client={client} navigationFailed={failed} navigationPending={pending} />
	) : (
		<span className="font-mono text-muted-foreground text-xs max-md:hidden" id={shellIds.live} role="status">
			connecting
		</span>
	);
}
