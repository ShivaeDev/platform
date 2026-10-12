import { renderToStaticMarkup } from "react-dom/server";
import { browserClient } from "#client/client.ts";
import { DiagnosticsPage } from "#client/react/DiagnosticsPage.tsx";
import { HandoffPage } from "#client/react/HandoffPage.tsx";
import { RespondPage } from "#client/react/RespondPage.tsx";
import { ResultPage } from "#client/react/ResultPage.tsx";
import { StartPage } from "#client/react/StartPage.tsx";
import type { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
export function renderDiagnostics(data: DiagnosticsSnapshot, now: number) {
	return renderToStaticMarkup(<DiagnosticsPage data={{ now, sources: data }} />);
}
export async function renderRemaining(origin: string, url: string) {
	const client = browserClient(origin);
	try {
		switch (new URL(url, origin).pathname) {
			case "/_board/diagnostics":
				return renderToStaticMarkup(<DiagnosticsPage data={await client.run(client.api.diagnostics.run(undefined))} />);
			case "/_board/start":
				return renderToStaticMarkup(<StartPage data={await client.run(client.api.start.run(undefined))} />);
			case "/_board/respond":
				return renderToStaticMarkup(<RespondPage data={await client.run(client.api.respond.run({ url }))} />);
			case "/_board/handoff":
				return renderToStaticMarkup(<HandoffPage data={await client.run(client.api.handoff.run({ url }))} />);
			case "/_board/result":
				return renderToStaticMarkup(<ResultPage data={await client.run(client.api.result.run({ url }))} />);
			default:
				throw new Error("Unknown view");
		}
	} finally {
		client.registry.dispose();
	}
}
