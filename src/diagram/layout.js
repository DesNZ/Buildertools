const VIEW_W = 1000
const VIEW_H = 680
const PADDING = { left: 112, right: 112, top: 126, bottom: 142 }
const LANE_STEP = 30

const uprightAngle = angle => {
  let a = angle
  while (a > 180) a -= 360
  while (a < -180) a += 360
  if (a > 90) a -= 180
  if (a < -90) a += 180
  return a
}

const rotatedBox = label => {
  const w = label.width
  const h = 24
  const r = (label.angle || 0) * Math.PI / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const bw = c * w + s * h
  const bh = s * w + c * h
  return { left: label.x - bw / 2, right: label.x + bw / 2, top: label.y - bh / 2, bottom: label.y + bh / 2 }
}

const overlaps = (a, b, pad = 7) => !(a.right + pad < b.left || b.right + pad < a.left || a.bottom + pad < b.top || b.bottom + pad < a.top)

const insideLabelArea = b => b.left >= 12 && b.right <= VIEW_W - 12 && b.top >= 82 && b.bottom <= VIEW_H - 18

export function layoutScene(scene) {
  const b = scene.bounds
  const worldW = Math.max(1, b.maxX - b.minX)
  const worldH = Math.max(1, b.maxY - b.minY)
  const scale = Math.min((VIEW_W - PADDING.left - PADDING.right) / worldW, (VIEW_H - PADDING.top - PADDING.bottom) / worldH)
  const usedW = worldW * scale
  const usedH = worldH * scale
  const left = (VIEW_W - usedW) / 2
  const top = (VIEW_H - usedH) / 2

  const map = p => ({ x: left + (p.x - b.minX) * scale, y: top + (b.maxY - p.y) * scale })
  const mapRect = s => {
    const tl = map({ x: s.x, y: s.y + s.h })
    return { ...s, sx: tl.x, sy: tl.y, sw: Math.max(0.5, s.w * scale), sh: Math.max(0.5, s.h * scale), sr: Math.max(0, (s.radiusWorld || 0) * scale) }
  }
  const mapShape = s => {
    if (s.kind === 'rect') return mapRect(s)
    if (s.kind === 'polygon' || s.kind === 'polyline') return { ...s, screenPoints: s.points.map(map), strokeWidth: s.widthPx || Math.max(1, (s.widthWorld || 0) * scale) }
    if (s.kind === 'line') return { ...s, sp1: map(s.p1), sp2: map(s.p2), strokeWidth: s.widthPx || Math.max(1, (s.widthWorld || 0) * scale) }
    return s
  }

  const placedLabelBoxes = []

  const layoutDimensionAtOffset = (d, offset) => {
    const a = map(d.p1)
    const z = map(d.p2)
    let q1 = { ...a }, q2 = { ...z }

    if (d.placement === 'above') {
      if (Math.abs(z.y - a.y) < 2) { q1.y -= offset; q2.y -= offset }
      else {
        const dx = z.x - a.x, dy = z.y - a.y, len = Math.hypot(dx, dy) || 1
        let nx = -dy / len, ny = dx / len
        if (ny > 0) { nx *= -1; ny *= -1 }
        q1 = { x: a.x + nx * offset, y: a.y + ny * offset }
        q2 = { x: z.x + nx * offset, y: z.y + ny * offset }
      }
    } else if (d.placement === 'below') {
      if (Math.abs(z.y - a.y) < 2) { q1.y += offset; q2.y += offset }
      else {
        const dx = z.x - a.x, dy = z.y - a.y, len = Math.hypot(dx, dy) || 1
        let nx = -dy / len, ny = dx / len
        if (ny < 0) { nx *= -1; ny *= -1 }
        q1 = { x: a.x + nx * offset, y: a.y + ny * offset }
        q2 = { x: z.x + nx * offset, y: z.y + ny * offset }
      }
    } else if (d.placement === 'left') {
      q1.x -= offset; q2.x -= offset
    } else if (d.placement === 'right') {
      q1.x += offset; q2.x += offset
    }

    const dx = q2.x - q1.x, dy = q2.y - q1.y, len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len
    const mid = { x: (q1.x + q2.x) / 2, y: (q1.y + q2.y) / 2 }
    const rawAngle = Math.atan2(dy, dx) * 180 / Math.PI
    const angle = d.rotate ? uprightAngle(rawAngle) : 0

    // Classic drafting style: the value sits ON its own dimension line.
    // The white label background breaks the line behind the text, making the
    // relationship between value and dimension unambiguous.
    const labelLayout = {
      x: mid.x,
      y: mid.y,
      angle,
      width: Math.max(34, d.label.length * 7.3 + 16)
    }

    return { ...d, a, z, q1, q2, nx, ny, tick: 9, labelLayout, effectiveOffset: offset }
  }

  const dimensions = scene.dimensions.map(d => {
    const base = Math.max(8, d.offset || 34)
    const candidateOffsets = [base]
    for (let lane = 1; lane <= 7; lane++) candidateOffsets.push(base + lane * LANE_STEP)
    // A small inward alternative is useful if an outward lane would hit the view edge.
    if (base > 22) candidateOffsets.push(Math.max(8, base - 18))

    let chosen = null
    let best = null
    let bestScore = Infinity

    for (const offset of candidateOffsets) {
      const candidate = layoutDimensionAtOffset(d, offset)
      const box = rotatedBox(candidate.labelLayout)
      const collisions = placedLabelBoxes.filter(p => overlaps(box, p, 7)).length
      const outsidePenalty = insideLabelArea(box) ? 0 : 100
      const score = collisions * 1000 + outsidePenalty + Math.abs(offset - base)

      if (score < bestScore) {
        bestScore = score
        best = candidate
      }
      if (collisions === 0 && outsidePenalty === 0) {
        chosen = candidate
        break
      }
    }

    chosen ||= best
    placedLabelBoxes.push(rotatedBox(chosen.labelLayout))
    return chosen
  })

  // Callouts remain separate from drafting dimensions. If a callout label would
  // land directly on a dimension value, move the callout as a whole rather than
  // moving only its text.
  const calloutBoxes = []
  const callouts = scene.callouts.map(c => {
    const a = map(c.anchor)
    const baseEnd = { x: a.x + c.dx, y: a.y + c.dy }
    const width = Math.max(42, c.text.length * 7 + 10)
    const candidates = [0, -30, 30, -60, 60]
    let end = baseEnd

    for (const dy of candidates) {
      const testEnd = { x: baseEnd.x, y: baseEnd.y + dy }
      const box = {
        left: testEnd.x + (c.dx >= 0 ? 4 : -width - 4),
        right: testEnd.x + (c.dx >= 0 ? width + 4 : -4),
        top: testEnd.y - 11,
        bottom: testEnd.y + 11
      }
      if (!placedLabelBoxes.some(p => overlaps(box, p, 6)) && !calloutBoxes.some(p => overlaps(box, p, 5))) {
        end = testEnd
        calloutBoxes.push(box)
        break
      }
    }

    const elbow = { x: a.x + (end.x - a.x) * 0.55, y: end.y }
    return { ...c, a, elbow, end }
  })

  return {
    ...scene,
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    width: VIEW_W,
    height: VIEW_H,
    scale,
    shapes: scene.shapes.map(mapShape),
    dimensions,
    callouts
  }
}
