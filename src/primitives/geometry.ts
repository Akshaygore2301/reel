/**
 * Stage geometry in video pixels (720x1280), measured off the reference reel with
 * a coordinate-grid overlay. Everything on the stage is drawn in this one
 * coordinate space — SVG viewBox and absolutely-positioned HTML text alike — so
 * lines and labels register exactly.
 *
 * The stage is mirror-symmetric about x = MID. Define the left side, derive the
 * right with `mirror`. Never hand-write right-side coordinates: they drift.
 */

export const MID = 360;

export const mirrorX = (x: number) => MID * 2 - x;

export type Pt = { x: number; y: number };
export type Quad = [Pt, Pt, Pt, Pt];

export type Side = 'left' | 'right';

/**
 * A monitor. Not a rectangle: the OUTER edge slants outward by 18px going down
 * while the inner edge stays vertical, so both screens appear angled toward the
 * viewer's centre. That single asymmetry is most of why the reference reads as a
 * drafting schematic rather than a pair of flat boxes.
 */
export const PANEL = {
  topY: 662,
  botY: 839,
  /** Edge facing the centre of the stage — vertical. */
  innerX: 321,
  /** Edge facing the frame edge — slants out with depth. */
  outerTopX: 87,
  outerBotX: 69,
  /** Bezel thickness: the gap between the outer wireframe and the screen face. */
  bezel: 10,
  legDrop: 39,
  legInset: 24,
  footR: 4.5,
} as const;

/** Corner points of a panel, optionally shrunk inward by `inset` px. */
export function panelQuad(side: Side, inset = 0): Quad {
  const topY = PANEL.topY + inset;
  const botY = PANEL.botY - inset;
  const innerX = PANEL.innerX - inset;
  const outerTopX = PANEL.outerTopX + inset;
  const outerBotX = PANEL.outerBotX + inset;

  // Left side, clockwise from top-outer.
  const pts: Quad = [
    { x: outerTopX, y: topY },
    { x: innerX, y: topY },
    { x: innerX, y: botY },
    { x: outerBotX, y: botY },
  ];

  return side === 'left' ? pts : (pts.map((p) => ({ x: mirrorX(p.x), y: p.y })) as Quad);
}

export const toPath = (q: Pt[]) => q.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';

/**
 * The screen face, as an axis-aligned box for laying out HTML text on top.
 * Uses the narrower (top) width so text never overruns the slanted edge.
 */
export function faceBox(side: Side) {
  const q = panelQuad(side, PANEL.bezel);
  const left = side === 'left' ? q[0].x : q[1].x;
  const right = side === 'left' ? q[1].x : q[0].x;
  return { left, top: q[0].y, width: right - left, height: q[2].y - q[0].y };
}

/** The shared emitter at the top of the stage. */
export const MACHINE = {
  bodyX: 240,
  bodyW: 160,
  bodyY: 500,
  bodyH: 58,
  /** Top rail with three segments. */
  railY: 483,
  railH: 17,
  /** The stack above the rail. */
  stackW: 62,
  stackH: 15,
  stackY: 456,
  fan: { cx: 272, cy: 529, r: 17 },
  /** Little dark LCD that shows the token currently being written. */
  lcd: { x: 288, y: 516, w: 100, h: 26 },
  baseY: 558,
  baseH: 14,
} as const;

/**
 * A belt runs from under the machine out to a panel's outer top corner. Chips
 * ride along it; slats scroll to show direction of travel.
 */
export const BELT = {
  fromX: 285,
  fromY: 572,
  toX: 92,
  toY: 660,
  /** Vertical thickness of the band (not perpendicular — it reads as depth). */
  band: 21,
  slats: 14,
  slatDrop: 11,
  slatDotR: 2.6,
} as const;

export function beltEnds(side: Side) {
  const a = { x: BELT.fromX, y: BELT.fromY };
  const b = { x: BELT.toX, y: BELT.toY };
  return side === 'left' ? { a, b } : { a: { x: mirrorX(a.x), y: a.y }, b: { x: mirrorX(b.x), y: b.y } };
}

/** Point at parameter t along a belt's upper edge. */
export function beltPoint(side: Side, t: number): Pt {
  const { a, b } = beltEnds(side);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * The cage on the slow path where finished units pile up unseen. Sits astride
 * the left belt. Its fill level IS the argument of the reel.
 */
export const CAGE = {
  x: 137,
  y: 598,
  w: 128,
  h: 74,
  /** Stack slots. Fewer, chunkier rows read as items; many thin ones read as hatching. */
  rows: 8,
} as const;

/** The counters above the stage. */
export const COUNTER = { y: 415, leftCx: 132, valueY: 440 } as const;

/** The delta panel between the two screens, revealed on the payoff cycle. */
export const STAT = {
  x: PANEL.innerX + 2,
  w: mirrorX(PANEL.innerX) - PANEL.innerX - 4,
  topY: 680,
  divY: 797,
  botY: 840,
} as const;

/** Titles under each panel. */
export const PANEL_TITLE = { y: 880, subY: 899 } as const;

/** Label block on the slow side naming the buffer. */
export const CAGE_LABEL = { cx: 122, y: 520, subY: 540 } as const;

/** Label block above the machine naming the source. */
export const SOURCE_LABEL = { cx: MID, y: 407, subY: 426 } as const;
