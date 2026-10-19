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
		<span className="text-muted-foreground text-xs max-md:hidden" data-state="connecting" id={shellIds.live} role="status">
			Connecting…
		</span>
	);
}
