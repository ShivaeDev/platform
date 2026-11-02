import { createServer } from "node:http";
import * as HttpStatus from "effect/http/HttpStatus";
import { loopbackServer } from "#internal/loopback.ts";

export function visitorHost() {
	return loopbackServer(
		createServer(async (request, response) => {
			const chunks: Buffer[] = [];
			for await (const chunk of request) {
				chunks.push(Buffer.from(chunk));
			}
			const body = Buffer.concat(chunks).toString();
			const path = request.url ?? "/";
			if (request.method === "POST" && path.startsWith("/cookies")) {
				const cookies: string[] = JSON.parse(body);
				response.setHeader("set-cookie", cookies);
			}
			if (path === "/redirect") {
				response.writeHead(HttpStatus.fromLiteral("SeeOther"), { location: "/echo", "set-cookie": "redirect=arrived; Path=/; HttpOnly" });
				response.end();
				return;
			}
			response.writeHead(HttpStatus.fromLiteral("OK"), { "content-type": "application/json" });
			response.end(
				JSON.stringify({
					body,
					cookies: request.headers.cookie ?? "",
					forwardedFor: request.headers["x-forwarded-for"] ?? "",
					forwardedHost: request.headers["x-forwarded-host"] ?? "",
					method: request.method,
					origin: request.headers.origin ?? "",
					path,
					realIp: request.headers["x-real-ip"] ?? "",
					scheme: request.headers["x-forwarded-proto"] ?? "",
				}),
			);
		}),
	);
}
