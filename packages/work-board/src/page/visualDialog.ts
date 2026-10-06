export const visualDialog = `<dialog id="visual-dialog" aria-labelledby="visual-title">
<div id="visual-stage">
<div class="visual-bar"><h2 id="visual-title">Visual evidence</h2><button id="visual-close" type="button">Close</button></div>
<p id="visual-context"></p>
<div class="visual-bar" role="group" aria-label="Visual controls">
<button id="visual-previous" type="button">Previous image</button><button id="visual-next" type="button">Next image</button>
<button id="visual-out" type="button" aria-label="Zoom out">−</button><button id="visual-fit" type="button">Fit</button><button id="visual-actual" type="button" aria-pressed="false">Actual size</button><button id="visual-in" type="button" aria-label="Zoom in">+</button>
<button id="visual-fullscreen" type="button">Fullscreen</button><a id="visual-download" download>Save locally</a>
</div><p id="visual-status" role="status"></p><div id="visual-viewport" tabindex="0" aria-label="Scrollable visual"><div id="visual-content"></div></div>
<p class="visual-help">Arrow keys choose images · Zoom and scroll to inspect · Escape returns to the source. Recorded evidence does not verify acceptance.</p>
</div></dialog>`;

export const visualStyles = `
#visual-dialog{width:min(1100px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text)}
#visual-dialog::backdrop{background:rgb(0 0 0 / .6)}
.visual-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.visual-bar h2{flex:1;margin:0;font-size:1.2rem}
.visual-bar button,.visual-bar a{font:inherit;padding:6px 10px;cursor:pointer;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px}
#visual-context,.visual-help,#visual-status{font-size:.85rem;overflow-wrap:anywhere;color:var(--muted)}
#visual-viewport{overflow:auto;max-height:65dvh;min-height:150px;background:var(--surface);border:1px solid var(--border);padding:12px}
#visual-content{width:100%;min-width:0}#visual-content img,#visual-content svg{display:block;width:100%;max-width:none;height:auto}
#visual-stage:fullscreen{width:100vw;height:100dvh;box-sizing:border-box;padding:16px;background:var(--card);color:var(--text);overflow:auto}#visual-stage:fullscreen #visual-viewport{max-height:75dvh}
[data-local-image]{cursor:zoom-in}[data-local-image]:focus-visible{outline:2px solid var(--focus)}
[data-visual-tools]{display:block;margin:8px 0;font-size:.85rem}[data-visual-tools] button{font:inherit;cursor:pointer;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:5px 10px}
[data-image-error]{display:block;color:var(--danger);font-size:.85rem}
`;
