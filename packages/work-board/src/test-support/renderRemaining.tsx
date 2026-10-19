import { renderToStaticMarkup } from "react-dom/server";
import { browserClient } from "#browserClient.ts";
import { FormContext } from "#client/react/FormContext.ts";
import { HandoffPage } from "#client/react/HandoffPage.tsx";
import { ResultPage } from "#client/react/ResultPage.tsx";
import { StartPage } from "#client/react/StartPage.tsx";
import { SystemPage } from "#client/react/SystemPage.tsx";
export async function renderRemaining(origin: string, url: string, now?: number) {
	const client = browserClient(origin);
	try {
		switch (new URL(url, origin).pathname) {
			case "/_board/system":
				return renderToStaticMarkup(
					<SystemPage data={{ ...(await client.run(client.api.diagnostics.run(undefined))), ...(now === undefined ? {} : { now }) }} />,
				);
			case "/_board/start":
				return renderToStaticMarkup(<StartPage data={await client.run(client.api.start.run(undefined))} />);
			case "/_board/handoff":
				return renderToStaticMarkup(
					<FormContext.Provider value={client}>
						<HandoffPage data={await client.run(client.api.handoff.run({ url }))} />
					</FormContext.Provider>,
				);
			case "/_board/result":
				return renderToStaticMarkup(<ResultPage data={await client.run(client.api.result.run({ url }))} />);
			default:
				throw new Error("Unknown view");
		}
	} finally {
		client.registry.dispose();
	}
}
