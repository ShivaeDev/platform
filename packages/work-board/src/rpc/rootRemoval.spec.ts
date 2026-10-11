import { afterEach, expect, it } from "vitest";
import { responseWorkspace } from "#test/responseEdges.ts";

let workspace: Awaited<ReturnType<typeof responseWorkspace>>;
afterEach(async () => workspace?.stop());

it("returns specific native read errors when an external process removes the workspace root", async () => {
	workspace = await responseWorkspace();
	const { client } = workspace;
	await client.run(client.api.navigation.run());
	workspace.notes.remove();
	await expect.poll(() => client.run(client.api.navigation.run()).then(() => "readable", String)).toContain("InternalServerError");
	await expect(client.run(client.api.navigation.run())).rejects.toMatchObject({ _tag: "InternalServerError" });
	await expect(client.run(client.api.search.run({ query: "review" }))).rejects.toMatchObject({
		_tag: "InternalServerError",
	});
	await expect(client.run(client.api.history.run({ action: "observe", baseline: null }))).rejects.toMatchObject({
		_tag: "InternalServerError",
	});
	await expect(client.run(client.api.page.run({ url: "/proposal.md" }))).rejects.toMatchObject({
		_tag: "InternalServerError",
	});
	await expect(client.run(client.handoffs.handoffs.run({ item: "investigation.choices" }))).rejects.toMatchObject({
		_tag: "ServiceUnavailable",
		message: "The workspace could not be indexed.",
	});
});
