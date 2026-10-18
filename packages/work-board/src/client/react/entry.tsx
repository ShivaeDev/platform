import { session } from "#client/session.ts";
import { mountBoard } from "./mountBoard.tsx";
import "#client/react/entry.css";

const container = document.querySelector("[data-board-react-root]");
if (container) {
	mountBoard(container, () => session(window));
}
