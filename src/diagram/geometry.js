const N = (v, k, d = 0) => {
  const x = Number(v?.[k])
  return Number.isFinite(x) ? x : d
}
const positive = (x, d = 1) => Math.max(Number.EPSILON, Number.isFinite(x) ? x : d)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const rad = deg => deg * Math.PI / 180
const deg = radian => radian * 180 / Math.PI
const pt = (x, y) => ({ x, y })

const emptyScene = (title, subtitle = '') => ({
  title,
  subtitle,
  bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 600 },
  shapes: [],
  dimensions: [],
  callouts: [],
  notes: []
})

const rect = (x, y, w, h, material = 'timber', extra = {}) => ({ kind: 'rect', x, y, w, h, material, ...extra })
const polygon = (points, material = 'timber', extra = {}) => ({ kind: 'polygon', points, material, ...extra })
const line = (p1, p2, material = 'line', extra = {}) => ({ kind: 'line', p1, p2, material, ...extra })
const polyline = (points, material = 'line', extra = {}) => ({ kind: 'polyline', points, material, ...extra })
const dimension = (p1, p2, label, placement, offset = 34, extra = {}) => ({ p1, p2, label: String(label), placement, offset, ...extra })
const callout = (anchor, text, dx, dy) => ({ anchor, text, dx, dy })

function rafterScene(v) {
  const run = positive(N(v, 'run', 3000))
  const overhang = Math.max(0, N(v, 'overhang', 450))
  const ridge = Math.max(0, N(v, 'ridgeThickness', 45))
  const seat = Math.max(0, N(v, 'seatCut', 70))
  const depth = positive(N(v, 'rafterDepth', 190))

  let angle, rise
  if (v?.mode === 'angle-run') {
    angle = rad(clamp(N(v, 'angle', 18.435), 0.1, 80))
    rise = Math.tan(angle) * run
  } else {
    rise = positive(N(v, 'rise', 1000))
    angle = Math.atan2(rise, run)
  }

  const drop = seat * Math.tan(angle)
  const effectiveRun = Math.max(1, run - ridge / 2)
  const common = effectiveRun / Math.cos(angle)
  const tail = overhang / Math.cos(angle)
  const total = common + tail
  const perpendicularNotchDepth = drop * Math.cos(angle)
  const remaining = Math.max(0, depth - perpendicularNotchDepth)

  // World origin is the OUTSIDE face of the wall at the seat level.
  // Positive y is upward. The uncut rafter soffit meets the seat at x=seat,y=0.
  const tailX = -overhang
  const ridgeFaceX = run - ridge / 2
  const soffitY = x => Math.tan(angle) * (x - seat)
  const verticalBoardDepth = depth / Math.cos(angle)

  const tailBottom = pt(tailX, soffitY(tailX))
  const heelBottom = pt(0, soffitY(0)) // = -drop
  const seatOutside = pt(0, 0)
  const seatInside = pt(seat, 0)
  const ridgeBottom = pt(ridgeFaceX, soffitY(ridgeFaceX))
  const ridgeTop = pt(ridgeFaceX, ridgeBottom.y + verticalBoardDepth)
  const tailTop = pt(tailX, tailBottom.y + verticalBoardDepth)

  const rafterPolygon = [tailBottom, heelBottom, seatOutside, seatInside, ridgeBottom, ridgeTop, tailTop]
  const ridgeHeight = Math.max(ridgeTop.y + 250, rise + depth)
  const wallStudWidth = Math.max(45, Math.min(90, seat * 0.7 || 45))
  const wallDepth = Math.max(900, rise * 0.45)

  const minY = Math.min(tailBottom.y - 140, -wallDepth)
  const maxY = Math.max(ridgeHeight, tailTop.y + 120)

  const s = emptyScene('Rafter', `Pitch ${deg(angle).toFixed(2)}° · common ${common.toFixed(1)} · remaining depth ${remaining.toFixed(1)}`)
  s.bounds = { minX: tailX - 160, maxX: run + Math.max(260, ridge + 180), minY, maxY }
  s.shapes.push(
    polygon(rafterPolygon, 'timber'),
    // plate width is intentionally the SEAT only: wall width is not part of notch maths.
    rect(0, -45, Math.max(seat, 45), 45, 'timber'),
    rect(Math.max(0, seat / 2 - wallStudWidth / 2), -wallDepth, wallStudWidth, wallDepth - 45, 'timberEdge'),
    rect(run - ridge / 2, -120, Math.max(ridge, 20), ridgeHeight + 120, 'metal')
  )
  s.dimensions.push(
    dimension(tailBottom, ridgeBottom, total.toFixed(1), 'above', 42, { rotate: true }),
    dimension(pt(0, 0), pt(run, 0), run.toFixed(0), 'below', 78),
    dimension(pt(-overhang, 0), pt(0, 0), overhang.toFixed(0), 'below', 38),
    dimension(pt(run, 0), pt(run, rise), rise.toFixed(0), 'right', 42, { rotate: true }),
    dimension(pt(0, 0), pt(seat, 0), seat.toFixed(0), 'above', 22),
    dimension(heelBottom, seatOutside, drop.toFixed(1), 'left', 20, { rotate: true })
  )
  s.callouts.push(
    callout(pt(seat * 0.55, -28), 'wall plate', 76, 54),
    callout(pt(run - ridge / 2, ridgeTop.y * 0.65), 'ridge board', 70, -24),
    callout(pt((tailX + ridgeFaceX) * 0.52, (tailTop.y + ridgeTop.y) * 0.50), 'rafter', 50, -48)
  )
  if (perpendicularNotchDepth > depth / 3) s.notes.push('Birdsmouth removes more than one-third of the rafter depth.')
  return s
}

function stairsScene(v) {
  const totalRise = positive(N(v, 'totalRise', 2700))
  const preferredRise = positive(N(v, 'preferredRise', 180))
  const going = positive(N(v, 'going', 250))
  const nosing = Math.max(0, N(v, 'nosing', 25))
  const risers = Math.max(1, Math.round(totalRise / preferredRise))
  const rise = totalRise / risers
  const goings = Math.max(0, risers - 1)
  const totalRun = goings * going
  const stringer = Math.hypot(totalRise, totalRun)
  const pitch = Math.atan2(totalRise, Math.max(totalRun, 1))
  const treadThickness = 30
  const riserThickness = 18

  const s = emptyScene('Stairs', `${risers} risers @ ${rise.toFixed(1)} · ${goings} goings @ ${going.toFixed(0)} · pitch ${deg(pitch).toFixed(2)}°`)
  s.bounds = { minX: -Math.max(350, going * 0.7), maxX: totalRun + Math.max(400, going), minY: -420, maxY: totalRise + 260 }

  // Stringer runs from floor datum to top-floor datum.
  s.shapes.push(line(pt(0, 0), pt(totalRun, totalRise), 'timberHeavy', { widthWorld: 90 }))

  // Treads and risers are placed from the ACTUAL rise/going grid.
  for (let i = 0; i < goings; i++) {
    const y = (i + 1) * rise
    const riserX = i * going
    const treadX = riserX - nosing
    s.shapes.push(rect(treadX, y - treadThickness, going + nosing, treadThickness, 'timber'))
    s.shapes.push(rect(riserX - riserThickness / 2, i * rise, riserThickness, rise - treadThickness, 'timberEdge'))
  }
  // Top riser / landing edge.
  s.shapes.push(rect(totalRun - riserThickness / 2, totalRise - rise, riserThickness, rise, 'timberEdge'))
  s.shapes.push(line(pt(totalRun, totalRise), pt(totalRun + going * 0.65, totalRise), 'floor', { widthPx: 4 }))
  s.shapes.push(line(pt(-going * 0.25, 0), pt(going * 0.65, 0), 'floor', { widthPx: 4 }))

  s.dimensions.push(
    dimension(pt(0, 0), pt(totalRun, 0), totalRun.toFixed(0), 'below', 58),
    dimension(pt(totalRun, 0), pt(totalRun, totalRise), totalRise.toFixed(0), 'right', 46, { rotate: true }),
    dimension(pt(0, 0), pt(totalRun, totalRise), stringer.toFixed(1), 'above', 42, { rotate: true })
  )
  if (goings > 0) {
    s.dimensions.push(
      dimension(pt(0, 0), pt(0, rise), rise.toFixed(1), 'left', 24, { rotate: true }),
      dimension(pt(0, rise), pt(going, rise), going.toFixed(0), 'above', 24)
    )
  }
  s.callouts.push(callout(pt(Math.min(totalRun * 0.55, going * 3), Math.min(totalRise * 0.55, rise * 6)), 'stringer', 48, -42))
  return s
}

function postHoleScene(v) {
  const mode = String(v?.mode || 'post-round-hole-square-post')
  const roundHole = mode.includes('round-hole')
  const roundPost = mode.includes('round-post')
  const depth = positive(N(v, 'holeDepth', 600))
  const holeWidth = roundHole ? positive(N(v, 'holeDiameter', 350)) : positive(N(v, 'holeWidth', 400))
  const holeOther = roundHole ? holeWidth : positive(N(v, 'holeLength', holeWidth))
  const postWidth = roundPost ? positive(N(v, 'postDiameter', 100)) : positive(N(v, 'postWidth', 100))
  const postOther = roundPost ? postWidth : positive(N(v, 'postThickness', postWidth))
  const embedInput = Math.max(0, N(v, 'postEmbedDepth', 0))
  const embed = embedInput > 0 ? Math.min(embedInput, depth) : depth
  const aboveGround = Math.max(350, depth * 0.55)
  const soilMargin = Math.max(holeWidth * 0.95, 350)

  const s = emptyScene('Post Hole', `${roundHole ? 'round' : 'square'} hole · ${roundPost ? 'round' : 'square'} post · embedment ${embed.toFixed(0)}`)
  s.bounds = { minX: -holeWidth / 2 - soilMargin, maxX: holeWidth / 2 + soilMargin, minY: -depth - 180, maxY: aboveGround + 180 }

  // Soil surrounds the excavation and continues underneath the concrete so
  // the section clearly reads as concrete bearing on undisturbed ground.
  const soilBelow = Math.max(110, depth * 0.18)
  s.shapes.push(
    rect(-holeWidth / 2 - soilMargin, -depth - soilBelow, soilMargin, depth + soilBelow, 'soil'),
    rect(holeWidth / 2, -depth - soilBelow, soilMargin, depth + soilBelow, 'soil'),
    rect(-holeWidth / 2, -depth - soilBelow, holeWidth, soilBelow, 'soil'),
    // Concrete still fills the full excavated hole depth; the earth shown below
    // is outside/below the excavation, not a reduction in concrete depth.
    rect(-holeWidth / 2, -depth, holeWidth, depth, 'concrete', { radiusWorld: Math.min(roundHole ? holeWidth * 0.16 : 0, 80) }),
    rect(-postWidth / 2, -embed, postWidth, embed + aboveGround, 'timberEdge', { radiusWorld: roundPost ? postWidth / 2 : 0 }),
    line(pt(-holeWidth / 2 - soilMargin, 0), pt(holeWidth / 2 + soilMargin, 0), 'grass', { widthPx: 5 })
  )

  s.dimensions.push(
    dimension(pt(-holeWidth / 2, -depth), pt(-holeWidth / 2, 0), depth.toFixed(0), 'left', 54, { rotate: true }),
    dimension(pt(-holeWidth / 2, -depth), pt(holeWidth / 2, -depth), roundHole ? `Ø ${holeWidth.toFixed(0)}` : `${holeWidth.toFixed(0)} × ${holeOther.toFixed(0)}`, 'below', 38),
    dimension(pt(holeWidth / 2, -embed), pt(holeWidth / 2, 0), embed.toFixed(0), 'right', 52, { rotate: true })
  )
  s.callouts.push(
    callout(pt(0, aboveGround * 0.55), roundPost ? `timber post Ø ${postWidth.toFixed(0)}` : `timber post ${postWidth.toFixed(0)} × ${postOther.toFixed(0)}`, 78, -32),
    callout(pt(holeWidth * 0.32, -depth * 0.68), 'concrete fill', 84, 42),
    callout(pt(holeWidth / 2 + soilMargin * 0.65, -depth * 0.45), 'soil / ground', 72, -36),
    callout(pt(0, -depth - soilBelow * 0.5), 'undisturbed soil', -100, 38)
  )
  return s
}

function rakedWallScene(v) {
  const L = positive(N(v, 'length', 4000))
  const low = positive(N(v, 'low', 2400))
  const high = Math.max(low, N(v, 'high', 3400))
  const spacing = positive(N(v, 'spacing', 450))
  const angle = Math.atan2(high - low, L)
  const topAt = x => low + (high - low) * (x / L)
  const plateDepth = 45
  const topPlateVertical = plateDepth / Math.cos(angle)
  const bottomPlate = 45
  const studWidth = 45

  // Stud LEFT edges advance by the requested centre spacing. This keeps
  // centre-to-centre spacing exact while the first/last studs remain inside the frame.
  const studLefts = []
  for (let x = 0; x <= L - studWidth + 1e-6; x += spacing) studLefts.push(x)
  if (!studLefts.length) studLefts.push(0)
  const lastFlush = Math.max(0, L - studWidth)
  if (Math.abs(studLefts[studLefts.length - 1] - lastFlush) > 1e-6 && lastFlush - studLefts[studLefts.length - 1] > spacing * 0.45) studLefts.push(lastFlush)

  const s = emptyScene('Raked Wall', `${deg(angle).toFixed(2)}° rake · ${spacing.toFixed(0)} centres · ${studLefts.length} studs`)
  s.bounds = { minX: -500, maxX: L + 650, minY: -350, maxY: high + 520 }

  s.shapes.push(
    rect(0, 0, L, bottomPlate, 'timber'),
    polygon([pt(0, low - topPlateVertical), pt(L, high - topPlateVertical), pt(L, high), pt(0, low)], 'timber')
  )

  for (const studLeft of studLefts) {
    const centreX = studLeft + studWidth / 2
    const yTop = topAt(Math.min(centreX, L)) - topPlateVertical
    s.shapes.push(rect(studLeft, bottomPlate, studWidth, Math.max(0, yTop - bottomPlate), 'timberEdge'))
  }

  s.dimensions.push(
    dimension(pt(0, low), pt(L, high), Math.hypot(L, high - low).toFixed(1), 'above', 38, { rotate: true }),
    dimension(pt(0, 0), pt(0, low), low.toFixed(0), 'left', 46, { rotate: true }),
    dimension(pt(L, 0), pt(L, high), high.toFixed(0), 'right', 46, { rotate: true }),
    dimension(pt(0, 0), pt(L, 0), L.toFixed(0), 'below', 48)
  )
  if (studLefts.length > 1) s.dimensions.push(dimension(pt(studLefts[0] + studWidth/2, bottomPlate + 140), pt(studLefts[1] + studWidth/2, bottomPlate + 140), spacing.toFixed(0), 'above', 16))

  s.callouts.push(
    callout(pt(L * 0.33, topAt(L * 0.33) - topPlateVertical / 2), 'top plate', 48, -44),
    callout(pt(L * 0.42, bottomPlate + (topAt(L * 0.42) - bottomPlate) * 0.45), 'studs', 58, 18),
    callout(pt(L * 0.72, bottomPlate / 2), 'bottom plate', 48, 42)
  )
  return s
}

function balusterScene(v, toolId) {
  const run = positive(N(v, 'run', N(v, 'length', 3000)))
  const width = positive(N(v, 'width', 40))
  const maxGap = Math.max(0, N(v, 'maxGap', 100))
  let count, gap
  if (toolId === 'equal-spacing') {
    count = Math.max(1, Math.round(N(v, 'count', 6)))
    gap = (run - count * width) / (count + 1)
  } else {
    count = Math.max(1, Math.ceil((run - maxGap) / (width + maxGap)))
    gap = (run - count * width) / (count + 1)
  }
  gap = Math.max(0, gap)
  const height = 900
  const railDepth = 70
  const noun = toolId === 'fence-pickets' ? 'Picket' : toolId === 'equal-spacing' ? 'Member' : 'Baluster'

  const s = emptyScene(`${noun} Spacing`, `${count} members · actual gap ${gap.toFixed(1)} · centres ${(gap + width).toFixed(1)}`)
  s.bounds = { minX: -300, maxX: run + 620, minY: -250, maxY: height + 360 }
  s.shapes.push(rect(0, 0, run, railDepth, 'timber'), rect(0, height - railDepth, run, railDepth, 'timber'))

  const starts = []
  for (let i = 0; i < count; i++) {
    const x = gap + i * (width + gap)
    starts.push(x)
    s.shapes.push(rect(x, railDepth, width, height - railDepth * 2, 'timberEdge'))
  }

  s.dimensions.push(
    dimension(pt(0, height), pt(run, height), run.toFixed(0), 'above', 62),
    dimension(pt(0, height), pt(gap, height), gap.toFixed(1), 'above', 28)
  )
  if (starts.length) s.dimensions.push(dimension(pt(starts[0], railDepth - 70), pt(starts[0] + width, railDepth - 70), width.toFixed(0), 'below', 18))
  if (starts.length > 1) {
    s.dimensions.push(
      dimension(pt(starts[0] + width, height * 0.52), pt(starts[1], height * 0.52), gap.toFixed(1), 'above', 18),
      dimension(pt(starts[0] + width / 2, height * 0.28), pt(starts[1] + width / 2, height * 0.28), (gap + width).toFixed(1), 'below', 18)
    )
  }
  s.callouts.push(callout(pt(run * 0.88, height - railDepth / 2), 'top rail', 74, -34), callout(pt(run * 0.22, railDepth / 2), 'bottom rail', -140, 54))
  if (maxGap > 0 && toolId !== 'equal-spacing') s.notes.push(`Maximum permitted clear gap: ${maxGap.toFixed(0)} mm`)
  return s
}

function deckingScene(v) {
  const L = positive(N(v, 'length', 6000))
  const W = positive(N(v, 'width', 4000))
  const board = positive(N(v, 'boardWidth', 90))
  const gap = Math.max(0, N(v, 'gap', 5))
  const joistSpacing = N(v, 'joistSpacing', 0)
  const rows = Math.max(1, Math.ceil((W + gap) / (board + gap)))
  const lastBoardStart = Math.max(0, (rows - 1) * (board + gap))
  const lastBoardRip = Math.max(0, Math.min(board, W - lastBoardStart))

  const s = emptyScene('Decking', `${rows} board rows · board ${board.toFixed(0)} · gap ${gap.toFixed(0)} · last rip ${lastBoardRip.toFixed(1)}`)
  s.bounds = { minX: -550, maxX: L + 650, minY: -500, maxY: W + 520 }

  if (joistSpacing > 0) {
    for (let x = 0; x <= L + 1e-6; x += joistSpacing) s.shapes.push(line(pt(Math.min(x, L), 0), pt(Math.min(x, L), W), 'joist', { widthWorld: 45, behind: true }))
  }

  let y = 0
  for (let i = 0; i < rows && y < W; i++) {
    const visibleWidth = Math.min(board, W - y)
    s.shapes.push(rect(0, y, L, visibleWidth, 'timber'))
    y += board + gap
  }

  s.dimensions.push(
    dimension(pt(0, W), pt(L, W), L.toFixed(0), 'above', 44),
    dimension(pt(0, 0), pt(0, W), W.toFixed(0), 'left', 48, { rotate: true })
  )
  if (rows > 1) {
    s.dimensions.push(
      dimension(pt(L * 0.15, 0), pt(L * 0.15, board), board.toFixed(0), 'left', 22, { rotate: true }),
      dimension(pt(L * 0.27, board), pt(L * 0.27, board + gap), gap.toFixed(0), 'right', 22, { rotate: true })
    )
  }
  if (lastBoardRip > 0) {
    s.dimensions.push(dimension(pt(L * 0.82, lastBoardStart), pt(L * 0.82, W), lastBoardRip.toFixed(1), 'right', 34, { rotate: true }))
    s.callouts.push(callout(pt(L * 0.72, lastBoardStart + lastBoardRip / 2), 'last board rip', 74, 44))
    s.notes.push(`Last deck board rip width: ${lastBoardRip.toFixed(1)} mm`)
  }
  s.callouts.push(callout(pt(L * 0.72, Math.min(board / 2, W / 2)), 'deck board', 70, -36))
  return s
}

function squareScene(v) {
  const L = positive(N(v, 'length', 3000))
  const W = positive(N(v, 'width', 4000))
  const frame = Math.min(90, Math.min(L, W) * 0.08)
  const d = Math.hypot(L, W)

  const s = emptyScene('Check Square', `Diagonal ${d.toFixed(1)}`)
  s.bounds = { minX: -450, maxX: L + 450, minY: -420, maxY: W + 480 }
  s.shapes.push(
    rect(0, 0, L, frame, 'timber'), rect(0, W - frame, L, frame, 'timber'),
    rect(0, frame, frame, W - frame * 2, 'timberEdge'), rect(L - frame, frame, frame, W - frame * 2, 'timberEdge'),
    line(pt(frame / 2, frame / 2), pt(L - frame / 2, W - frame / 2), 'checkLine', { widthPx: 2 }),
    line(pt(frame / 2, W - frame / 2), pt(L - frame / 2, frame / 2), 'checkLine', { widthPx: 2 })
  )
  s.dimensions.push(
    dimension(pt(0, W), pt(L, W), L.toFixed(0), 'above', 44),
    dimension(pt(0, 0), pt(0, W), W.toFixed(0), 'left', 44, { rotate: true }),
    dimension(pt(0, 0), pt(L, W), d.toFixed(1), 'above', 16, { rotate: true }),
    dimension(pt(0, W), pt(L, 0), d.toFixed(1), 'below', 16, { rotate: true })
  )
  return s
}

function triangleScene(v) {
  const rise = Math.abs(N(v, 'a', N(v, 'fall', 300)))
  const run = positive(N(v, 'b', N(v, 'run', 400)))
  const a = Math.max(rise, 1)
  const c = Math.hypot(run, a)
  const angle = Math.atan2(a, run)
  const thickness = Math.min(80, Math.min(run, a) * 0.08)

  const s = emptyScene('Right Triangle', `Angle ${deg(angle).toFixed(2)}° · hypotenuse ${c.toFixed(1)}`)
  s.bounds = { minX: -400, maxX: run + 500, minY: -420, maxY: a + 500 }
  s.shapes.push(
    line(pt(0, 0), pt(run, 0), 'timberHeavy', { widthWorld: thickness }),
    line(pt(run, 0), pt(run, a), 'timberHeavy', { widthWorld: thickness }),
    line(pt(0, 0), pt(run, a), 'timberHeavy', { widthWorld: thickness })
  )
  s.dimensions.push(
    dimension(pt(0, 0), pt(run, 0), run.toFixed(0), 'below', 48),
    dimension(pt(run, 0), pt(run, a), a.toFixed(0), 'right', 48, { rotate: true }),
    dimension(pt(0, 0), pt(run, a), c.toFixed(1), 'above', 36, { rotate: true })
  )
  return s
}


function solveGeneralTriangle(v) {
  const mode = String(v?.mode || 'sss')
  const safeAcos = x => Math.acos(clamp(x, -1, 1))
  const safeAsin = x => Math.asin(clamp(x, -1, 1))
  const angleOk = (x, name) => {
    const a = N(v, x, NaN)
    if (!Number.isFinite(a) || a <= 0 || a >= 180) throw new Error(`${name} must be between 0° and 180°`)
    return rad(a)
  }
  const side = (key, name) => positive(N(v, key, NaN), NaN)
  const finalize = (a, b, c, A, B, C) => {
    if (![a,b,c,A,B,C].every(Number.isFinite) || a <= 0 || b <= 0 || c <= 0 || A <= 0 || B <= 0 || C <= 0) throw new Error('These measurements do not form a valid triangle')
    if (a + b <= c || a + c <= b || b + c <= a) throw new Error('These side lengths do not form a triangle')
    const area = 0.5 * b * c * Math.sin(A)
    return { a, b, c, A, B, C, area, perimeter: a + b + c }
  }

  if (mode === 'sss') {
    const a = side('a','Side A'), b = side('b','Side B'), c = side('c','Side C')
    if (a + b <= c || a + c <= b || b + c <= a) throw new Error('The three sides fail the triangle inequality')
    const A = safeAcos((b*b + c*c - a*a) / (2*b*c))
    const B = safeAcos((a*a + c*c - b*b) / (2*a*c))
    const C = Math.PI - A - B
    return { primary: finalize(a,b,c,A,B,C), alternatives: [] }
  }

  if (mode === 'sas') {
    const a = side('a','Side A'), b = side('b','Side B'), C = angleOk('angleC','Angle C')
    const c = Math.sqrt(Math.max(0, a*a + b*b - 2*a*b*Math.cos(C)))
    const A = safeAcos((b*b + c*c - a*a) / (2*b*c))
    const B = Math.PI - A - C
    return { primary: finalize(a,b,c,A,B,C), alternatives: [] }
  }

  if (mode === 'asa') {
    const A = angleOk('angleA','Angle A'), B = angleOk('angleB','Angle B')
    const C = Math.PI - A - B
    if (C <= 0) throw new Error('Angles A and B must add to less than 180°')
    const knownSide = String(v?.knownSide || 'c')
    const known = positive(N(v,'knownSideValue',NaN), NaN)
    if (!Number.isFinite(known) || known <= 0) throw new Error('Known side must be greater than 0')
    const angleFor = knownSide === 'a' ? A : knownSide === 'b' ? B : C
    const k = known / Math.sin(angleFor)
    return { primary: finalize(k*Math.sin(A), k*Math.sin(B), k*Math.sin(C), A, B, C), alternatives: [] }
  }

  if (mode === 'ssa') {
    const a = side('a','Side A'), b = side('b','Side B'), A = angleOk('angleA','Angle A')
    const sinB = b * Math.sin(A) / a
    if (sinB > 1 + 1e-10) throw new Error('No triangle exists for these SSA measurements')
    const B1 = safeAsin(sinB)
    const C1 = Math.PI - A - B1
    const sols = []
    if (C1 > 1e-10) {
      const c1 = a * Math.sin(C1) / Math.sin(A)
      sols.push(finalize(a,b,c1,A,B1,C1))
    }
    const B2 = Math.PI - B1
    const C2 = Math.PI - A - B2
    if (C2 > 1e-10 && Math.abs(B2 - B1) > 1e-8) {
      const c2 = a * Math.sin(C2) / Math.sin(A)
      sols.push(finalize(a,b,c2,A,B2,C2))
    }
    if (!sols.length) throw new Error('No triangle exists for these SSA measurements')
    const selected = String(v?.ssaSolution || 'first') === 'second' && sols[1] ? 1 : 0
    return { primary: sols[selected], alternatives: sols.filter((_,i)=>i!==selected), solutionCount: sols.length }
  }

  throw new Error('Unknown triangle input method')
}

function generalTriangleScene(v) {
  const solved = solveGeneralTriangle(v)
  const t = solved.primary
  // Standard notation: side a is opposite A, b opposite B, c opposite C.
  // Place A at the origin, B on the x-axis, and solve C from the side lengths.
  const xC = (t.b*t.b + t.c*t.c - t.a*t.a) / (2*t.c)
  const ySq = Math.max(0, t.b*t.b - xC*xC)
  const yC = Math.sqrt(ySq)
  const A = pt(0,0), B = pt(t.c,0), C = pt(xC,yC)
  const thickness = Math.max(20, Math.min(t.a,t.b,t.c) * 0.035)
  const margin = Math.max(220, Math.max(t.a,t.b,t.c) * 0.18)

  const s = emptyScene('General Triangle', `A ${deg(t.A).toFixed(2)}° · B ${deg(t.B).toFixed(2)}° · C ${deg(t.C).toFixed(2)}°`)
  s.bounds = {
    minX: Math.min(0,xC) - margin,
    maxX: Math.max(t.c,xC) + margin,
    minY: -margin,
    maxY: yC + margin * 1.25
  }
  s.shapes.push(
    line(A,B,'timberHeavy',{widthWorld:thickness}),
    line(B,C,'timberHeavy',{widthWorld:thickness}),
    line(C,A,'timberHeavy',{widthWorld:thickness})
  )
  s.dimensions.push(
    dimension(A,B,`c ${t.c.toFixed(1)}`,'below',46),
    dimension(A,C,`b ${t.b.toFixed(1)}`,'above',38,{rotate:true}),
    dimension(B,C,`a ${t.a.toFixed(1)}`,'above',38,{rotate:true})
  )
  s.callouts.push(
    callout(A,`A ${deg(t.A).toFixed(2)}°`,-54,34),
    callout(B,`B ${deg(t.B).toFixed(2)}°`,54,34),
    callout(C,`C ${deg(t.C).toFixed(2)}°`,0,-48)
  )
  s.notes.push(`Area ${t.area.toFixed(1)} mm² · perimeter ${t.perimeter.toFixed(1)} mm`)
  if ((solved.solutionCount || 1) > 1) s.notes.push('SSA has two valid solutions; use the solution selector to switch the diagram.')
  return s
}

function arcScene(v) {
  const r = positive(N(v, 'radius', 2000))
  const included = clamp(positive(N(v, 'angle', 90)), 1, 179.5)
  const a = rad(included)
  const half = a / 2
  const chord = 2 * r * Math.sin(half)
  const rise = r * (1 - Math.cos(half))
  const length = r * a
  const yChord = r * Math.cos(half)
  const left = pt(-chord / 2, yChord)
  const right = pt(chord / 2, yChord)
  const top = pt(0, r)
  const steps = 48
  const points = []
  for (let i = 0; i <= steps; i++) {
    const theta = Math.PI / 2 + half - (a * i / steps)
    points.push(pt(r * Math.cos(theta), r * Math.sin(theta)))
  }

  const s = emptyScene('Arc', `Radius ${r.toFixed(0)} · included angle ${included.toFixed(1)}°`)
  s.bounds = { minX: -chord / 2 - 500, maxX: chord / 2 + 500, minY: -Math.max(900, r * 0.2), maxY: r + 650 }
  s.shapes.push(polyline(points, 'timberArc', { widthWorld: Math.max(35, r * 0.035) }), line(left, right, 'construction', { widthPx: 1.5 }), line(pt(0, 0), left, 'constructionDashed', { widthPx: 1.4 }), line(pt(0, 0), right, 'constructionDashed', { widthPx: 1.4 }))
  s.dimensions.push(
    dimension(left, right, chord.toFixed(1), 'below', 34),
    dimension(pt(0, yChord), top, rise.toFixed(1), 'right', 26, { rotate: true }),
    dimension(pt(0, 0), right, r.toFixed(0), 'below', 18, { rotate: true })
  )
  s.notes.push(`Arc length: ${length.toFixed(1)} mm`)
  s.callouts.push(callout(pt(0, 0), 'centre', 38, 34))
  return s
}

export function buildDiagramScene(type, values = {}, toolId = '') {
  if (type === 'rafter') return rafterScene(values)
  if (type === 'stairs') return stairsScene(values)
  if (type === 'concrete' && String(values?.mode || '').startsWith('post-')) return postHoleScene(values)
  if (type === 'raked') return rakedWallScene(values)
  if (type === 'baluster') return balusterScene(values, toolId)
  if (type === 'decking') return deckingScene(values)
  if (type === 'square') return squareScene(values)
  if (type === 'triangle') return triangleScene(values)
  if (type === 'triangle-general') return generalTriangleScene(values)
  if (type === 'arc') return arcScene(values)
  return emptyScene('Diagram', 'No scaled diagram is available for this mode yet.')
}

export const __test = { rafterScene, stairsScene, postHoleScene, rakedWallScene, balusterScene, deckingScene, squareScene, triangleScene, generalTriangleScene, solveGeneralTriangle, arcScene }
