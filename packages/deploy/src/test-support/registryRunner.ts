import { readFileSync } from "node:fs";
import process from "node:process";
import { volume } from "railway/iac";
import { databaseService } from "#adapters/railway/databaseService.ts";

interface Scenario {
	cmd?: string[];
	entrypoint?: string[];
	singleManifest?: boolean;
	status?: number;
}

const scenario: Scenario = JSON.parse(readFileSync(0, "utf8"));
const requests: string[] = [];
globalThis.fetch = (input) => registryResponse(String(input));

function registryResponse(url: string): Promise<Response> {
	requests.push(url);
	if (scenario.status) {
		return Promise.resolve(new Response("registry unavailable", { status: scenario.status }));
	}
	if (url.includes("/token?")) {
		return Promise.resolve(Response.json({ token: "anonymous-pull" }));
	}
	if (url.endsWith("/manifests/18") && !scenario.singleManifest) {
		return Promise.resolve(
			Response.json({
				manifests: [
					{ digest: "amd64", platform: { architecture: "amd64", os: "linux" } },
					{ digest: "arm64", platform: { architecture: "arm64", os: "linux" } },
					{
						digest: "attestation",
						platform: { architecture: "unknown", os: "unknown" },
					},
				],
			}),
		);
	}
	if (url.includes("/manifests/")) {
		return Promise.resolve(Response.json({ config: { digest: url.split("/").at(-1) } }));
	}
	if (url.includes("/blobs/")) {
		return Promise.resolve(
			Response.json({
				config: {
					Cmd: scenario.cmd ?? ["postgres", "-p", "5432", "-c", "listen_addresses=*"],
					Entrypoint: url.endsWith("/arm64")
						? (scenario.entrypoint ?? ["/usr/bin/tini", "-g", "--", "/usr/local/bin/wrapper.sh"])
						: ["/usr/bin/tini", "-g", "--", "/usr/local/bin/wrapper.sh"],
				},
			}),
		);
	}
	throw new Error(`Unexpected registry request ${url}`);
}

try {
	const database = await databaseService("Postgres", {
		limits: { cpu: 1, memoryBytes: 536_870_912 },
		volume: volume("postgres-data"),
	});
	process.stdout.write(JSON.stringify({ database, requests }));
} catch (error) {
	const messages: string[] = [];
	for (let cause = error; cause instanceof Error; cause = cause.cause) {
		messages.push(cause.message);
	}
	process.stdout.write(JSON.stringify({ refused: messages.join(": "), requests }));
}
