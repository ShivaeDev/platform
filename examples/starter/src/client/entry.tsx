import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "#client/entry.css";

const container = document.getElementById("root");
if (container === null) {
	throw new Error("Missing application root");
}
createRoot(container).render(<App />);
