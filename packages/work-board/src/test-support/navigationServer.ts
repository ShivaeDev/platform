import { folder, startBoard } from "./board.ts";
import { workspaceFixture } from "./workspaceFixture.ts";

const notes = folder(workspaceFixture());
const board = await startBoard(notes.root, "board.md");
process.stdout.write(`${board.url}\n`);
process.on("SIGTERM", async () => {
	await board.stop();
	notes.remove();
});
