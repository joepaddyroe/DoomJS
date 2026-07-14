import { SCREENHEIGHT, SCREENWIDTH, SBARHEIGHT } from '../core/renderConstants.js';

/**
 * 3D view dimensions (r_main.c — R_ExecuteSetViewSize).
 * @param {number} screenBlocks Vanilla screenblocks (3–11).
 * @param {number} detailLevel 0 = high detail, 1 = low detail.
 */
export function computeViewSize(screenBlocks, detailLevel) {
  let scaledViewWidth;
  let viewHeight;

  if (screenBlocks >= 11) {
    scaledViewWidth = SCREENWIDTH;
    viewHeight = SCREENHEIGHT;
  } else {
    scaledViewWidth = screenBlocks * 32;
    viewHeight = ((screenBlocks * 168) / 10) & ~7;
  }

  const detailShift = detailLevel ? 1 : 0;
  const viewWidth = scaledViewWidth >> detailShift;
  const fullscreen = scaledViewWidth === SCREENWIDTH && viewHeight === SCREENHEIGHT;

  return {
    screenBlocks,
    scaledViewWidth,
    viewHeight,
    viewWidth,
    detailShift,
    fullscreen,
    showStatusBar: !fullscreen,
    viewAreaHeight: fullscreen ? SCREENHEIGHT : SCREENHEIGHT - SBARHEIGHT,
  };
}

/** Menu slider 0–8 → vanilla screenblocks 3–11. */
export function screenBlocksFromMenuSize(screenSize) {
  return Math.max(3, Math.min(11, screenSize + 3));
}
