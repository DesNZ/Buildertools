<script setup>
import { computed } from 'vue'
import { buildDiagramScene } from './diagram/geometry'
import { layoutScene } from './diagram/layout'

const props = defineProps({ type: String, values: Object, toolId: String })
const diagram = computed(() => layoutScene(buildDiagramScene(props.type, props.values || {}, props.toolId || '')))
const points = arr => arr.map(p => `${p.x},${p.y}`).join(' ')
const matClass = material => `mat-${material}`
</script>

<template>
  <section v-if="type" class="visual-card diagram-system">
    <div class="visual-title">
      <div><span>VISUALISER</span><strong>{{ diagram.title }}</strong></div>
      <span class="nts">ALL MEASUREMENTS IN MILLIMETRES</span>
    </div>

    <svg class="diagram" :viewBox="diagram.viewBox" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="`${diagram.title} scaled diagram`">
      <defs>
        <linearGradient id="timberFaceGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f0d29b"/><stop offset="45%" stop-color="#dfb979"/><stop offset="100%" stop-color="#c9934d"/>
        </linearGradient>
        <linearGradient id="timberEdgeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#deb775"/><stop offset="100%" stop-color="#b77d39"/>
        </linearGradient>
        <linearGradient id="metalGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d3d8dd"/><stop offset="100%" stop-color="#919aa4"/>
        </linearGradient>
        <pattern id="soilPattern" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="#6c472d"/><circle cx="6" cy="7" r="2" fill="#956743"/><circle cx="18" cy="17" r="1.6" fill="#815536"/><path d="M2 21q6-6 12 0" stroke="#4f3423" stroke-width="1" fill="none" opacity=".55"/>
        </pattern>
        <pattern id="concretePattern" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="#cfd3d6"/><circle cx="5" cy="8" r="1.7" fill="#858c93"/><circle cx="16" cy="12" r="1.5" fill="#9aa0a6"/><circle cx="11" cy="20" r="1.2" fill="#767d84"/>
        </pattern>
        <filter id="materialShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#344054" flood-opacity=".15"/></filter>
      </defs>

      <rect width="1000" height="620" class="canvas-bg"/>
      <text x="64" y="42" class="scene-title">{{ diagram.title }}</text>
      <text x="64" y="64" class="scene-subtitle">{{ diagram.subtitle }}</text>

      <!-- material geometry, all mapped from the same millimetre coordinate space -->
      <template v-for="(shape, i) in diagram.shapes" :key="`shape-${i}`">
        <rect v-if="shape.kind==='rect'" :x="shape.sx" :y="shape.sy" :width="shape.sw" :height="shape.sh" :rx="shape.sr" :class="['material', matClass(shape.material)]"/>
        <polygon v-else-if="shape.kind==='polygon'" :points="points(shape.screenPoints)" :class="['material', matClass(shape.material)]"/>
        <polyline v-else-if="shape.kind==='polyline'" :points="points(shape.screenPoints)" :class="['material-line', matClass(shape.material)]" :style="{strokeWidth: `${shape.strokeWidth}px`}"/>
        <line v-else-if="shape.kind==='line'" :x1="shape.sp1.x" :y1="shape.sp1.y" :x2="shape.sp2.x" :y2="shape.sp2.y" :class="['material-line', matClass(shape.material)]" :style="{strokeWidth: `${shape.strokeWidth}px`}"/>
      </template>

      <!-- drafting dimensions: extension lines + tick-ended dimension line + readable label -->
      <g v-for="(d, i) in diagram.dimensions" :key="`dim-${i}`" class="dimension-group">
        <line :x1="d.a.x" :y1="d.a.y" :x2="d.q1.x" :y2="d.q1.y" class="extension-line"/>
        <line :x1="d.z.x" :y1="d.z.y" :x2="d.q2.x" :y2="d.q2.y" class="extension-line"/>
        <line :x1="d.q1.x" :y1="d.q1.y" :x2="d.q2.x" :y2="d.q2.y" class="dimension-line"/>
        <line :x1="d.q1.x-d.nx*d.tick" :y1="d.q1.y-d.ny*d.tick" :x2="d.q1.x+d.nx*d.tick" :y2="d.q1.y+d.ny*d.tick" class="dimension-tick"/>
        <line :x1="d.q2.x-d.nx*d.tick" :y1="d.q2.y-d.ny*d.tick" :x2="d.q2.x+d.nx*d.tick" :y2="d.q2.y+d.ny*d.tick" class="dimension-tick"/>
        <g :transform="`translate(${d.labelLayout.x} ${d.labelLayout.y}) rotate(${d.labelLayout.angle})`">
          <rect :x="-d.labelLayout.width/2" y="-11" :width="d.labelLayout.width" height="22" rx="5" class="dimension-label-bg"/>
          <text x="0" y="4" class="dimension-label" text-anchor="middle">{{ d.label }}</text>
        </g>
      </g>

      <g v-for="(c, i) in diagram.callouts" :key="`callout-${i}`">
        <circle :cx="c.a.x" :cy="c.a.y" r="3.5" class="callout-dot"/>
        <polyline :points="`${c.a.x},${c.a.y} ${c.elbow.x},${c.elbow.y} ${c.end.x},${c.end.y}`" class="callout-line"/>
        <text :x="c.end.x + (c.dx >= 0 ? 7 : -7)" :y="c.end.y + 4" :text-anchor="c.dx >= 0 ? 'start' : 'end'" class="callout-text">{{ c.text }}</text>
      </g>

      <g v-if="diagram.notes.length" class="notes">
        <rect x="64" :y="570 - Math.min(42, diagram.notes.length*18)" width="872" :height="Math.min(46, 14 + diagram.notes.length*18)" rx="9" class="note-bg"/>
        <text v-for="(note, i) in diagram.notes" :key="i" x="78" :y="590 - Math.min(24, (diagram.notes.length-1)*18) + i*18" class="note-text">{{ note }}</text>
      </g>
    </svg>
  </section>
</template>

<style scoped>
.diagram-system .diagram{display:block;width:100%;height:auto;border:1px solid #e4ddd5;border-radius:16px;background:#fbfbfa}
.canvas-bg{fill:#fbfbfa}.scene-title{fill:#20262d;font-size:18px;font-weight:900}.scene-subtitle{fill:#69717b;font-size:11.5px;font-weight:600}
.material{stroke-width:1.5;filter:url(#materialShadow)}.material-line{fill:none;stroke-linecap:butt;stroke-linejoin:round}
.mat-timber{fill:url(#timberFaceGrad);stroke:#ac7635}.mat-timberEdge{fill:url(#timberEdgeGrad);stroke:#98662e}.mat-metal{fill:url(#metalGrad);stroke:#737c86}
.material-line.mat-timberHeavy,.material-line.mat-timberArc{stroke:#d6a45e}.material-line.mat-floor{stroke:#8c949d}.material-line.mat-checkLine{stroke:#364152}.material-line.mat-construction{stroke:#65717d}.material-line.mat-constructionDashed{stroke:#65717d;stroke-dasharray:8 6}.material-line.mat-grass{stroke:#6e9d4e}.material-line.mat-joist{stroke:#af793d}
.mat-soil{fill:url(#soilPattern);stroke:#5b3b27}.mat-concrete{fill:url(#concretePattern);stroke:#858c93}
.extension-line{stroke:#a6abb1;stroke-width:1;stroke-dasharray:3 3}.dimension-line,.dimension-tick{stroke:#646b74;stroke-width:1.5;stroke-linecap:round}.dimension-label-bg{fill:#fbfbfa;stroke:#e4e6e8;stroke-width:.6}.dimension-label{fill:#2f353c;font-size:11.5px;font-weight:800}
.callout-line{fill:none;stroke:#555e68;stroke-width:1.25}.callout-dot{fill:#46505a}.callout-text{fill:#303740;font-size:11.5px;font-weight:700}
.note-bg{fill:#f7f2ea;stroke:#e4d7c6;stroke-width:1}.note-text{fill:#6e583e;font-size:10.5px;font-weight:700}
@media(max-width:560px){.scene-title{font-size:20px}.scene-subtitle{font-size:12px}.dimension-label{font-size:13px}.callout-text{font-size:12.5px}.diagram-system .diagram{border-radius:12px}}
</style>
