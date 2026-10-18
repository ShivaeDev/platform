import { parentPort, workerData } from "node:worker_threads";
import { createDashboardHandler } from "@pg-boss/dashboard/handler";

const config: { readonly databaseUrl: string } = workerData;
const dashboard = createDashboardHandler({ basePath: "/admin/jobs", databases: [{ name: "Application", url: config.databaseUrl }] });
const port = parentPort;
if (port === null) {
	throw new Error("The job board needs a worker thread");
}

port.on(
	"message",
	async ({
		id,
		message,
	}: {
		id: number;
		message: { readonly url: string; readonly method: string; readonly headers: [string, string][] } | "close";
	}) => {
		try {
			if (message === "close") {
				await dashboard.close();
				port.postMessage({ id, reply: {} });
				return;
			}
			const response = await dashboard(new Request(message.url, { headers: message.headers, method: message.method }));
			const body = new Uint8Array(await response.arrayBuffer());
			port.postMessage({ id, reply: { body, headers: [...response.headers], status: response.status } }, [body.buffer]);
		} catch (error) {
			port.postMessage({ error: error instanceof Error ? error.message : String(error), id });
		}
	},
);
