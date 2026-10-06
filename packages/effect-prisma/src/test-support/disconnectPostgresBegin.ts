import { createConnection, createServer, type Socket } from "node:net";

function packetLength(buffered: Buffer, startup: boolean): number {
	return startup ? buffered.readInt32BE(0) : buffered.readInt32BE(1) + 1;
}

function isBeginPacket(packet: Buffer, startup: boolean): boolean {
	return !startup && packet[0] === 81 && packet.subarray(5).toString() === "BEGIN\0";
}

export async function disconnectPostgresBegin(connection: string) {
	const target = new URL(connection);
	const sockets = new Set<Socket>();
	let begins = 0;
	const server = createServer((frontend) => {
		const backend = createConnection({ host: target.hostname, port: Number(target.port) });
		for (const socket of [frontend, backend]) {
			sockets.add(socket);
			socket.on("close", () => sockets.delete(socket));
			socket.on("error", () => {
				frontend.destroy();
				backend.destroy();
			});
		}
		backend.pipe(frontend);
		let startup = true;
		let buffered = Buffer.alloc(0);
		frontend.on("data", (chunk: Buffer) => {
			buffered = Buffer.concat([buffered, chunk]);
			while (buffered.length >= (startup ? 4 : 5)) {
				const length = packetLength(buffered, startup);
				if (buffered.length < length) {
					return;
				}
				const packet = buffered.subarray(0, length);
				buffered = buffered.subarray(length);
				if (isBeginPacket(packet, startup)) {
					begins += 1;
					frontend.destroy();
					backend.destroy();
					return;
				}
				startup = false;
				backend.write(packet);
			}
		});
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("The PostgreSQL interruption proxy did not bind a TCP port");
	}
	const url = new URL(connection);
	url.hostname = "127.0.0.1";
	url.port = String(address.port);
	url.searchParams.set("sslmode", "disable");
	return {
		begins: () => begins,
		close: () => {
			for (const socket of sockets) {
				socket.destroy();
			}
			return new Promise<void>((resolve, reject) => server.close((error) => (error === undefined ? resolve() : reject(error))));
		},
		url: url.toString(),
	};
}
