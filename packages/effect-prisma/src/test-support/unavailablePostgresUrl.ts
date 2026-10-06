import { createServer } from "node:net";

export async function unavailablePostgresUrl(connection: string): Promise<string> {
	const server = createServer();
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("The unavailable PostgreSQL endpoint did not bind a TCP port");
	}
	await new Promise<void>((resolve, reject) => server.close((error) => (error === undefined ? resolve() : reject(error))));
	const url = new URL(connection);
	url.hostname = "127.0.0.1";
	url.port = String(address.port);
	return url.toString();
}
