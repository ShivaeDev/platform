import { SessionBoundary } from "#client/sessionBoundary.ts";
import { render } from "#client/testing.ts";
import { connect } from "./connect.ts";
import { Notes } from "./screen.tsx";

export function openScreen(url: string) {
	window.location.href = url;
	return render(
		<SessionBoundary connect={() => connect(url)} identify={(session) => session} recheck={() => undefined} session="alice">
			{(client) => <Notes client={client} />}
		</SessionBoundary>,
	);
}
