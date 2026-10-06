import { escapeHtml } from "./escape.ts";
import { startTemplates } from "./startTemplates.ts";

export function startHtml(empty = false): string {
	return `<article class="doc onboarding"><h1>${empty ? "Start your local workspace" : "Project and report templates"}</h1>
<p>Work Board reads Markdown files from your workspace folder. Use your editor or existing agent tools to create and update them; this viewer does not write project files.</p>
<ol><li>Choose a template below. Focus its text area, select all, and copy the Markdown.</li><li>Save it in the served folder with the suggested filename, or adjust its links to your chosen filenames.</li><li>Replace the example IDs with unique stable IDs and update every matching relationship and criterion reference. Frontmatter is optional; ordinary Markdown and existing heading boards also work.</li><li>Fill in real context and observations. Work Board discovers saved files automatically. Start with the project, then follow the investigation and result links.</li></ol>
<p>Unknown checks stay unknown. Add criterion evidence only after a real observation; a finished agent run is not verified acceptance. No project content is created or marked seen by opening these templates.</p>
${startTemplates.map((template) => `<section class="start-template"><h2>${template.label}</h2><p>Suggested file: <code>${template.file}</code></p><details data-key="template:${template.file}"><summary>Read and copy ${template.label.toLowerCase()} Markdown</summary><label for="template-${template.file}">${template.label} template Markdown</label><textarea id="template-${template.file}" readonly rows="16" spellcheck="false">${escapeHtml(template.source)}</textarea></details></section>`).join("")}</article>`;
}
