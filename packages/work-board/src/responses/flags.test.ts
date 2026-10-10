import { expect, it } from "vitest";
import { flags } from "#responses/flags.ts";

it("rejects incomplete or unknown agent flags with actionable usage", () => {
	for (const args of [["--port"], ["--port", ""], ["--unknown", "value"]]) {
		expect(() => flags(args)).toThrow("Use --port, --url, --revision or --after, each with a value.");
	}
});

it("rejects repeated options instead of silently choosing an agent destination", () => {
	expect(() => flags(["--port", "4747", "--port", "4848"])).toThrow("Repeated option --port");
});

it("rejects invalid TCP ports and accepts both boundary ports", () => {
	for (const port of ["0", "65536", "-1", "1.5", "4747x", "100000"]) {
		expect(() => flags(["--port", port])).toThrow("Invalid port.");
	}
	expect(flags(["--port", "1"]).url).toBe("http://127.0.0.1:1");
	expect(flags(["--port", "65535"]).url).toBe("http://127.0.0.1:65535");
});

it("requires one explicit destination when both URL and port are supplied", () => {
	expect(() => flags(["--url", "http://localhost:4848", "--port", "4747"])).toThrow("Choose --url or --port.");
	expect(flags(["--url", "http://localhost:4848", "--revision", "reviewed", "--after", "response.edge"])).toEqual({
		after: "response.edge",
		revision: "reviewed",
		url: "http://localhost:4848",
	});
});
