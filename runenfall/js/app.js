// Gemeinsamer Treffpunkt, damit sich die Module nicht gegenseitig importieren müssen.
// main.js füllt die Funktionen beim Start.
export const app = {
  nav: () => {},
  startRun: () => {},
  continueRun: () => {},
  showMap: () => {},
  treeView: null,
  combat: null,
};
