export const searchDialog = `<dialog id="search-dialog" aria-labelledby="search-title">
<div class="search-header"><h2 id="search-title">Find work</h2><button type="button" id="search-close" aria-label="Close search">Close</button></div>
<form id="search-form"><label for="search-query">Search documents, headings, and passages</label><input id="search-query" type="search" autocomplete="off" maxlength="200" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="search-results"><button type="submit">Search</button></form>
<p class="search-help">Ctrl/Cmd+K to open · ↑/↓ to choose · Enter to open · Escape to close</p>
<p id="search-status" role="status"></p><ul id="search-results" role="listbox" aria-label="Search results"></ul>
</dialog>`;

export const searchStyles = `
#search-dialog{width:min(680px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:20px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text)}
#search-dialog::backdrop{background:rgb(0 0 0 / .45)}
.search-header{display:flex;justify-content:space-between;align-items:center;gap:12px}.search-header h2{margin:0;font-size:1.3rem}
#search-form{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:16px}#search-form label{grid-column:1/-1}#search-query{min-width:0;width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);font:inherit}
.search-help{margin-top:12px}.search-help,#search-status{font-size:.85rem;color:var(--muted)}#search-results{list-style:none;padding:0;margin:0}
#search-results a{display:block;padding:12px;border-radius:6px;text-decoration:none;overflow-wrap:anywhere}#search-results a[aria-selected="true"]{background:var(--surface);outline:2px solid var(--focus);outline-offset:-2px}
#search-results strong,#search-results small,#search-results p{display:block}#search-results small{color:var(--muted);font-size:.8rem}#search-results p{margin:6px 0 0;font-size:.9rem}
`;
