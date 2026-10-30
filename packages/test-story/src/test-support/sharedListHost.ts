import { Effect } from "effect";
import { domHost } from "./domHost.ts";

export const sharedListHost = Effect.gen(function* () {
	const items: string[] = [];
	return yield* domHost(async (request, response) => {
		const name = request.headers.cookie?.match(/member=(?<name>\w+)/u)?.groups?.name;
		response.setHeader("content-type", "application/json");
		if (request.url === "/sign-out") {
			response.setHeader("set-cookie", "member=; Max-Age=0; Path=/; HttpOnly");
			response.end("null");
			return;
		}
		if (name === undefined) {
			response.writeHead(401).end(JSON.stringify({ message: "Signed out" }));
			return;
		}
		if (request.method === "POST") {
			let title = "";
			for await (const chunk of request) {
				title += chunk.toString();
			}
			items.push(`${name}: ${title}`);
		}
		response.end(JSON.stringify({ items, name }));
	});
});
