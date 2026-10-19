import type { ReactNode } from "react";
import { prerender } from "react-dom/static";
import { browserClient } from "#client/client.ts";
import { FormContext } from "#client/react/FormContext.ts";
import { HandoffPage } from "#client/react/HandoffPage.tsx";
import { ResultPage } from "#client/react/ResultPage.tsx";
import { StartPage } from "#client/react/StartPage.tsx";
import { SystemPage } from "#client/react/SystemPage.tsx";

// prerender waits for the lazily loaded Markdown renderers; dropping React's text and Suspense markers leaves static markup.
async function staticMarkup(page: ReactNode) {
	const { prelude } = await prerender(page);
	return (await new Response(prelude).text()).replace(/<!--(?: |\/?\$[?!]?)-->/gu, "");
}
export async function renderRemaining(origin: string, url: string, now?: number) {
	const client = browserClient(origin);
	try {
		switch (new URL(url, origin).pathname) {
			case "/_board/system":
				return await staticMarkup(
					<SystemPage data={{ ...(await client.run(client.api.diagnostics.run(undefined))), ...(now === undefined ? {} : { now }) }} />,
				);
			case "/_board/start":
				return await staticMarkup(<StartPage data={await client.run(client.api.start.run(undefined))} />);
			case "/_board/handoff":
				return await staticMarkup(
					<FormContext.Provider value={client}>
						<HandoffPage data={await client.run(client.api.handoff.run({ url }))} />
					</FormContext.Provider>,
				);
			case "/_board/result":
				return await staticMarkup(<ResultPage data={await client.run(client.api.result.run({ url }))} />);
			default:
				throw new Error("Unknown view");
		}
	} finally {
		client.registry.dispose();
	}
}
