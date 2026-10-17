import { once } from "node:events";
import { createServer } from "node:http";

export async function oauthProvider() {
	const requests: { readonly method: string | undefined; readonly path: string; readonly body: string; readonly cookie: string | undefined }[] = [];
	const server = createServer(async (request, response) => {
		const url = new URL(request.url ?? "/", "https://github.com");
		const chunks: Buffer[] = [];
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk));
		}
		requests.push({ body: Buffer.concat(chunks).toString(), cookie: request.headers.cookie, method: request.method, path: url.pathname });
		if (url.pathname === "/login/oauth/authorize") {
			const callback = new URL(url.searchParams.get("redirect_uri") ?? "");
			callback.searchParams.set("state", url.searchParams.get("state") ?? "");
			callback.searchParams.set("code", "story-code");
			response.writeHead(302, { location: callback.href });
			response.end();
			return;
		}
		response.setHeader("content-type", "application/json");
		switch (url.pathname) {
			case "/login/oauth/access_token":
				response.end(JSON.stringify({ "access_token": "story-token", scope: "read:user,user:email", "token_type": "bearer" }));
				break;
			case "/user":
				response.end(JSON.stringify({ "avatar_url": null, email: "alice@social.test", id: 123, login: "alice", name: "Alice" }));
				break;
			case "/user/emails":
				response.end(JSON.stringify([{ email: "alice@social.test", primary: true, verified: true }]));
				break;
			default:
				response.writeHead(404).end();
		}
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("OAuth provider needs a TCP address");
	}
	return {
		close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
		requests,
		url: `http://127.0.0.1:${address.port}`,
	};
}
