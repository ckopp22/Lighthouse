// Tunable game rules. Loaded as a classic <script> (not an ES module) so the
// game also works when index.html is opened straight from disk (file://).
window.LIGHTHOUSE_CONFIG = {
  dieFaces: [2, 3, 4, 5, 6, 'LIGHTHOUSE'],
  winTarget: 100,
  diceCount: 3
};
