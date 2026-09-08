<script setup>
import { computed, ref, watch } from 'vue'
import { calculators, categories } from './calculators'
import Visualizer from './Visualizer.vue'

const selectedId = ref(localStorage.getItem('chippy:selected') || 'roof')
const search = ref('')
const category = ref('All')
const values = ref({})
const output = ref([])
const error = ref('')
const tab = ref('tools')
const favourites = ref(JSON.parse(localStorage.getItem('chippy:favourites') || '[]'))
const history = ref(JSON.parse(localStorage.getItem('chippy:history') || '[]'))

const selected = computed(() => calculators.find(c => c.id === selectedId.value) || calculators[0])
const visibleFields = computed(() => selected.value.fields.filter(f => !f.show || f.show(values.value)))
const filtered = computed(() => calculators.filter(c => {
  const q = search.value.toLowerCase().trim()
  return (category.value === 'All' || c.category === category.value) && (!q || `${c.name} ${c.category} ${c.description}`.toLowerCase().includes(q))
}))
const favouritesList = computed(() => calculators.filter(c => favourites.value.includes(c.id)))
const showVisual = computed(() => !!selected.value.visual && !(selected.value.id === 'concrete' && !String(values.value.mode || '').startsWith('post-')))

function reset(){
  values.value = Object.fromEntries(selected.value.fields.map(f => [f.key, f.value]))
  output.value = []
  error.value = ''
}
function open(id){
  selectedId.value = id
  localStorage.setItem('chippy:selected', id)
  tab.value = 'calc'
  reset()
  liveCalculate()
}
function liveCalculate(){
  try {
    error.value = ''
    output.value = selected.value.calc(values.value)
  } catch (e) {
    error.value = e.message || 'Calculation failed'
    output.value = []
  }
}
function saveResult(){
  liveCalculate()
  if (error.value || !output.value.length) return
  const rec = { id: String(Date.now()), tool: selected.value.name, toolId: selected.value.id, at: new Date().toISOString(), values: { ...values.value }, results: output.value }
  history.value = [rec, ...history.value].slice(0, 40)
  localStorage.setItem('chippy:history', JSON.stringify(history.value))
}
function toggleFav(id){
  favourites.value = favourites.value.includes(id) ? favourites.value.filter(x => x !== id) : [...favourites.value, id]
  localStorage.setItem('chippy:favourites', JSON.stringify(favourites.value))
}
function restore(item){
  selectedId.value = item.toolId
  reset()
  values.value = { ...item.values }
  output.value = item.results
  tab.value = 'calc'
}
function clearHistory(){
  history.value = []
  localStorage.removeItem('chippy:history')
}

watch(selectedId, reset, { immediate: true })
watch(values, () => { if (tab.value === 'calc') liveCalculate() }, { deep: true })
</script>

<template>
<div class="app-shell">
  <header class="topbar">
    <button v-if="tab==='calc'" class="back" @click="tab='tools'" aria-label="Back to tools">←</button>
    <div class="brand"><strong>CHIPPY</strong><span>Metric construction calculators · offline PWA</span></div>
    <span class="offline">OFFLINE</span>
  </header>

  <main>
    <section v-if="tab==='tools'" class="page">
      <div class="hero">
        <p class="eyebrow">TOOLBOX</p>
        <h1>Measure it. See it. Build it.</h1>
        <p>Metric construction calculators with scaled live diagrams and drafting-style measurements.</p>
      </div>

      <div v-if="favouritesList.length" class="section">
        <h2>Favourites</h2>
        <div class="tool-grid compact">
          <button v-for="c in favouritesList" :key="c.id" class="tool-card" @click="open(c.id)">
            <span>{{c.category}}</span><strong>{{c.name}}</strong><small>{{c.description}}</small>
          </button>
        </div>
      </div>

      <div class="filters">
        <input v-model="search" placeholder="Search calculators…" aria-label="Search calculators">
        <div class="chips">
          <button :class="{active:category==='All'}" @click="category='All'">All</button>
          <button v-for="c in categories" :key="c" :class="{active:category===c}" @click="category=c">{{c}}</button>
        </div>
      </div>

      <div class="tool-grid">
        <article v-for="c in filtered" :key="c.id" class="tool-card-wrap">
          <button class="fav" @click="toggleFav(c.id)" :aria-label="`Toggle ${c.name} favourite`">{{favourites.includes(c.id)?'★':'☆'}}</button>
          <button class="tool-card" @click="open(c.id)">
            <span>{{c.category}}</span><strong>{{c.name}}</strong><small>{{c.description}}</small><em v-if="c.visual">LIVE DIAGRAM</em>
          </button>
        </article>
      </div>
    </section>

    <section v-else-if="tab==='calc'" class="page calc-page">
      <div class="calc-head">
        <div><p class="eyebrow">{{selected.category}}</p><h1>{{selected.name}}</h1><p>{{selected.description}}</p></div>
        <button class="star" @click="toggleFav(selected.id)" :aria-label="`Toggle ${selected.name} favourite`">{{favourites.includes(selected.id)?'★':'☆'}}</button>
      </div>

      <div class="calc-layout" :class="{single:!showVisual}">
        <div class="input-column">
          <form class="calc-card" @submit.prevent="saveResult">
            <div class="field-grid">
              <label v-for="field in visibleFields" :key="field.key">
                <span>{{field.label}}</span>
                <select v-if="field.type==='select'" v-model="values[field.key]">
                  <option v-for="o in field.options" :key="o[0]" :value="o[0]">{{o[1]}}</option>
                </select>
                <input v-else v-model="values[field.key]" :type="field.type" :inputmode="field.type==='number'?'decimal':'text'" step="any" autocomplete="off">
              </label>
            </div>
            <div class="actions"><button type="button" class="secondary" @click="reset();liveCalculate()">Reset</button><button type="submit" class="primary">Save result</button></div>
          </form>
          <div v-if="error" class="error">{{error}}</div>
        </div>
        <div v-if="showVisual" class="visual-column"><Visualizer :type="selected.visual" :values="values" :tool-id="selected.id" /></div>
      </div>

      <section v-if="output.length" class="results-card">
        <p class="eyebrow">LIVE RESULTS</p>
        <div class="results-grid"><div v-for="r in output" :key="r.label" class="result"><span>{{r.label}}</span><strong>{{r.value}} <small>{{r.unit}}</small></strong></div></div>
      </section>
      <p class="safety">Diagrams are calculation aids, not engineering drawings. Verify critical dimensions, structural requirements and applicable building code before cutting or construction.</p>
    </section>

    <section v-else class="page">
      <div class="history-head"><div><p class="eyebrow">ON THIS DEVICE</p><h1>History</h1></div><button v-if="history.length" class="secondary" @click="clearHistory">Clear</button></div>
      <p v-if="!history.length" class="empty">No saved calculations yet.</p>
      <button v-for="h in history" :key="h.id" class="history" @click="restore(h)"><span><strong>{{h.tool}}</strong><small>{{new Date(h.at).toLocaleString()}}</small></span><b>Open →</b></button>
    </section>
  </main>

  <nav class="bottom-nav">
    <button :class="{active:tab==='tools'}" @click="tab='tools'"><b>▦</b>Tools</button>
    <button :class="{active:tab==='calc'}" @click="tab='calc'"><b>△</b>Calculator</button>
    <button :class="{active:tab==='history'}" @click="tab='history'"><b>↺</b>History</button>
  </nav>
</div>
</template>
