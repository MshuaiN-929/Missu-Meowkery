// Replace asset paths here. null means use the plain CSS placeholder.
window.DIARY_CONFIG = {
  assets: {
    font: 'assets/fonts/FontsLabShouZhangTi-2.ttf',
    paper: null,
    cover: null,
    illustrations: {},
    cards: {}
  },
  layout: {
    // Keep the original 374px text width and 15-line capacity to preserve pagination.
    desktop: { width: 500, height: 720, fontSize: 22, lineHeight: 32, insetX: 63, insetOuter: 55, insetInner: 71, insetTop: 75, insetBottom: 60, headingHeight: 80 },
    mobile: { fontSize: 20, lineHeight: 31, insetX: 27, insetTop: 30, insetBottom: 38 },
    mobileBreakpoint: 760,
    turnDuration: 820
  },
  // Extension contract: normal paper and future smaller inserts have different kinds.
  pageTypes: {
    paper: { size: 'full', renderer: 'text' },
    card: { size: 'small', renderer: null, implemented: false }
  }
};
