import { expect } from "vitest";
import { responseFunctionStory } from "#test/responseFunctionStory.ts";

responseFunctionStory.it("rejects incomplete or unknown agent flags with actionable usage", [], ({ flags }) => {
	for (const args of [["--port"], ["--port", ""], ["--unknown", "value"]]) {
		expect(() => flags(args)).toThrow("Use --port, --url, --revision or --after, each with a value.");
	}
});

responseFunctionStory.it("rejects repeated options instead of silently choosing an agent destination", [], ({ flags }) => {
	expect(() => flags(["--port", "4747", "--port", "4848"])).toThrow("Repeated option --port");
});

responseFunctionStory.it("rejects invalid TCP ports and accepts both boundary ports", [], ({ flags }) => {
	for (const port of ["0", "65536", "-1", "1.5", "4747x", "100000"]) {
		expect(() => flags(["--port", port])).toThrow("Invalid port. Use an integer from 1 to 65535.");
	}
	expect(flags(["--port", "1"]).url).toBe("http://127.0.0.1:1");
	expect(flags(["--port", "65535"]).url).toBe("http://127.0.0.1:65535");
});

responseFunctionStory.it("requires one explicit destination when both URL and port are supplied", [], ({ flags }) => {
	expect(() => flags(["--url", "http://localhost:4848", "--port", "4747"])).toThrow("Choose --url or --port.");
	expect(flags(["--url", "http://localhost:4848", "--revision", "reviewed", "--after", "response.edge"])).toEqual({
		after: "response.edge",
		revision: "reviewed",
		url: "http://localhost:4848",
	});
});
