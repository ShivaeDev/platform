export function ageScript() {
	return `
const since = (modified) => {
  const seconds = Math.max(0, Math.round((Date.now() - modified) / 1000));
  if (seconds < 60) return seconds + "s";
  if (seconds < 3600) return Math.round(seconds / 60) + "m";
  if (seconds < 172800) return Math.round(seconds / 3600) + "h";
  return Math.round(seconds / 86400) + "d";
};

export const tick = () => {
  for (const age of document.querySelectorAll("[data-modified]")) {
    const ago = since(Number(age.dataset.modified));
    age.textContent = age.classList.contains("short") ? ago : "updated " + ago + " ago";
  }
};

document.addEventListener("board-page", tick);
tick();
setInterval(tick, 5000);
`;
}
