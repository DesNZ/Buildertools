const f=(key,label,value,opts={})=>({key,label,value,type:'number',...opts})
const t=(key,label,value,opts={})=>({key,label,value,type:'text',...opts})
const s=(key,label,value,options,opts={})=>({key,label,value,type:'select',options,...opts})
const n=(v,k)=>{const x=Number(v[k]);if(!Number.isFinite(x))throw new Error(`${k} must be a number`);return x}
const pos=(x,label)=>{if(!(x>0))throw new Error(`${label} must be greater than 0`);return x}
const round=(x,d=2)=>Number(Number(x).toFixed(d))
const R=(label,value,unit='')=>({label,value,unit})
const waste=(m3,pct)=>m3*(1+Math.max(0,Number(pct)||0)/100)
const areaCircle=d=>Math.PI*(d/2)**2

function concrete(v){
  const mode=v.mode||'slab', w=Math.max(0,Number(v.waste)||0); let m3=0, extra=[]
  if(mode==='slab'||mode==='strip') m3=pos(n(v,'length'),'Length')*pos(n(v,'width'),'Width')*pos(n(v,'depth'),'Depth')/1e9
  else if(mode==='circular') m3=areaCircle(pos(n(v,'diameter'),'Diameter'))*pos(n(v,'depth'),'Depth')/1e9
  else if(mode==='square-column') m3=pos(n(v,'side'),'Column side')**2*pos(n(v,'height'),'Height')/1e9
  else if(mode==='round-column') m3=areaCircle(pos(n(v,'diameter'),'Diameter'))*pos(n(v,'height'),'Height')/1e9
  else if(mode.startsWith('post-')){
    const holeDepth=pos(n(v,'holeDepth'),'Hole depth')
    const holeArea=mode.includes('round-hole')?areaCircle(pos(n(v,'holeDiameter'),'Hole diameter')):pos(n(v,'holeWidth'),'Hole width')*pos(n(v,'holeLength'),'Hole length')
    const postArea=mode.includes('round-post')?areaCircle(pos(n(v,'postDiameter'),'Post diameter')):pos(n(v,'postWidth'),'Post width')*pos(n(v,'postThickness'),'Post thickness')
    if(postArea>=holeArea) throw new Error('Post cross-section must be smaller than the hole')
    const embedInput=Math.max(0,Number(v.postEmbedDepth)||0)
    const embeddedDepth=embedInput>0?Math.min(embedInput,holeDepth):holeDepth
    const qty=Math.max(1,Math.round(n(v,'quantity')))
    const grossPerHole=holeArea*holeDepth/1e9
    const displacementPerHole=postArea*embeddedDepth/1e9
    const netPerHole=grossPerHole-displacementPerHole
    if(netPerHole<=0) throw new Error('Post displacement leaves no concrete volume')
    m3=netPerHole*qty
    extra=[R('Gross hole volume',round(grossPerHole,5),'m³ / hole'),R('Post displacement',round(displacementPerHole,5),'m³ / hole'),R('Net concrete per hole',round(netPerHole,5),'m³'),R('Holes',qty)]
  } else if(mode==='stairs'){
    const width=pos(n(v,'stairWidth'),'Stair width'), rise=pos(n(v,'rise'),'Rise'), going=pos(n(v,'going'),'Going'), steps=Math.max(1,Math.round(n(v,'steps')))
    m3=width*going*rise*(steps*(steps+1)/2)/1e9
  } else if(mode==='kerb'){
    const length=pos(n(v,'length'),'Length'), curbA=pos(n(v,'curbWidth'),'Kerb width')*pos(n(v,'curbHeight'),'Kerb height'), gutterA=pos(n(v,'gutterWidth'),'Gutter width')*pos(n(v,'gutterDepth'),'Gutter depth')
    m3=length*(curbA+gutterA)/1e9
  }
  const bags=Number(v.bagYield)>0?Math.ceil(waste(m3,w)/(Number(v.bagYield)/1000)):null
  return [...extra,R('Concrete volume',round(m3,4),'m³'),R('Order quantity',round(waste(m3,w),4),'m³'),...(bags?[R('Approx bags',bags,`${v.bagYield} L yield`)]:[])]
}

function bulk(v,label='Volume'){
  const m3=pos(n(v,'length'),'Length')*pos(n(v,'width'),'Width')*pos(n(v,'depth'),'Depth')/1e9, w=Math.max(0,Number(v.waste)||10), density=Math.max(0,Number(v.density)||0)
  const out=[R(label,round(m3,3),'m³'),R('With allowance',round(waste(m3,w),3),'m³')]
  if(density) out.push(R('Estimated mass',round(waste(m3,w)*density/1000,2),'t'))
  return out
}
function gravel(v){return bulk(v,'Gravel volume')}
function soil(v){return bulk(v,'Soil volume')}
function asphalt(v){
  const m3=pos(n(v,'length'),'Length')*pos(n(v,'width'),'Width')*pos(n(v,'depth'),'Depth')/1e9, density=pos(n(v,'density'),'Compacted density'), factor=pos(n(v,'compaction'),'Compaction factor')
  return [R('Area',round(n(v,'length')*n(v,'width')/1e6,2),'m²'),R('Compacted volume',round(m3,3),'m³'),R('Estimated asphalt',round(m3*density/1000*factor,2),'t')]
}
function stairs(v){
  const total=pos(n(v,'totalRise'),'Total rise'),pref=pos(n(v,'preferredRise'),'Preferred rise'),going=pos(n(v,'going'),'Going'),nosing=Math.max(0,n(v,'nosing'))
  let risers=Math.max(1,Math.round(total/pref)); const rise=total/risers,goings=Math.max(0,risers-1),run=goings*going,stringer=Math.hypot(total,run),angle=Math.atan2(total,run||1)*180/Math.PI
  return [R('Risers',risers),R('Actual rise',round(rise,1),'mm'),R('Goings',goings),R('Going / nosing to nosing',round(going,1),'mm'),R('Nosing',round(nosing,1),'mm'),R('Tread depth',round(going+nosing,1),'mm'),R('Total run',round(run,1),'mm'),R('Stringer',round(stringer,1),'mm'),R('Pitch',round(angle,2),'°')]
}
function raked(v){
  const L=pos(n(v,'length'),'Wall length'),low=pos(n(v,'low'),'Low height'),high=pos(n(v,'high'),'High height'),spacing=pos(n(v,'spacing'),'Stud spacing'); if(high<low)throw new Error('High height must be at least the low height')
  const angle=Math.atan2(high-low,L)*180/Math.PI, positions=[]; for(let x=0;x<=L+1e-6;x+=spacing)positions.push(Math.min(x,L)); if(positions.at(-1)<L)positions.push(L)
  const studs=positions.map(x=>round(low+(high-low)*(x/L),1))
  return [R('Rake angle',round(angle,2),'°'),R('Stud count',studs.length),R('Stud lengths',studs.join(', '),'mm')]
}
function roof(v){
  const mode=v.mode||'rise-run'; let run=pos(n(v,'run'),'Run'),rise,angle
  if(mode==='angle-run'){angle=pos(n(v,'angle'),'Angle')*Math.PI/180;rise=Math.tan(angle)*run}else{rise=pos(n(v,'rise'),'Rise');angle=Math.atan2(rise,run)}
  const overhang=Math.max(0,n(v,'overhang')), seat=Math.max(0,n(v,'seatCut')), depth=pos(n(v,'rafterDepth'),'Rafter depth'), ridge=Math.max(0,n(v,'ridgeThickness'))
  const effectiveRun=Math.max(.001,run-ridge/2), common=effectiveRun/Math.cos(angle), tail=overhang/Math.cos(angle), total=common+tail, seatDrop=seat*Math.tan(angle), notchPerp=seatDrop*Math.cos(angle), remaining=Math.max(0,depth-notchPerp)
  return [R('Pitch angle',round(angle*180/Math.PI,2),'°'),R('Rise per metre',round(rise/run*1000,1),'mm/m'),R('Run to ridge face',round(effectiveRun,1),'mm'),R('Common rafter',round(common,1),'mm'),R('Tail length',round(tail,1),'mm'),R('Overall rafter',round(total,1),'mm'),R('Seat / bearing cut',round(seat,1),'mm'),R('Birdsmouth drop',round(seatDrop,1),'mm'),R('Notch depth perpendicular',round(notchPerp,1),'mm'),R('Remaining rafter depth',round(remaining,1),'mm')]
}
function baluster(v){
  const run=pos(n(v,'run'),'Run'), width=pos(n(v,'width'),'Baluster width'), maxGap=pos(n(v,'maxGap'),'Maximum gap')
  let count=Math.max(1,Math.ceil((run-maxGap)/(width+maxGap))), gap=(run-count*width)/(count+1)
  while(gap>maxGap){count++;gap=(run-count*width)/(count+1)}
  if(gap<0)throw new Error('Balusters do not fit in the run')
  return [R('Balusters',count),R('Equal end / clear gap',round(gap,1),'mm'),R('Centre spacing',round(width+gap,1),'mm')]
}
function decking(v){
  const L=pos(n(v,'length'),'Length'),W=pos(n(v,'width'),'Width'),board=pos(n(v,'boardWidth'),'Board width'),gap=Math.max(0,n(v,'gap'))
  const rows=Math.max(1,Math.ceil((W+gap)/(board+gap)))
  const lastBoard=Math.max(0,Math.min(board,W-(rows-1)*(board+gap)))
  const lm=rows*L/1000
  const out=[R('Deck area',round(L*W/1e6,2),'m²'),R('Board rows',rows),R('Last board rip width',round(lastBoard,1),'mm'),R('Board lineal metres',round(lm,2),'m')]
  const wastePct=Math.max(0,Number(v.waste)||0); if(Object.prototype.hasOwnProperty.call(v,'waste'))out.push(R('Boards incl. waste',round(lm*(1+wastePct/100),2),'lineal m'))
  const js=Number(v.joistSpacing); if(Number.isFinite(js)&&js>0){const joists=Math.ceil(L/js)+1;out.push(R('Joists',joists),R('Total joist length',round(joists*W/1000,2),'m'));const spf=Math.max(0,Math.round(Number(v.screwsPerFix)||0));if(spf)out.push(R('Approx screws',joists*rows*spf))}
  const bs=Number(v.bearerSpacing); if(Number.isFinite(bs)&&bs>0){const bearers=Math.ceil(W/bs)+1;out.push(R('Bearers',bearers),R('Total bearer length',round(bearers*L/1000,2),'m'))}
  return out
}
function pickets(v){
  const run=pos(n(v,'run'),'Fence run'),width=pos(n(v,'width'),'Picket width'),maxGap=pos(n(v,'maxGap'),'Maximum gap');let count=Math.max(1,Math.ceil((run-maxGap)/(width+maxGap))),gap=(run-count*width)/(count+1);while(gap>maxGap){count++;gap=(run-count*width)/(count+1)};return[R('Pickets',count),R('Equal gap',round(gap,1),'mm'),R('Centre spacing',round(width+gap,1),'mm')]
}
function wainscot(v){const L=pos(n(v,'length'),'Wall length'),stile=pos(n(v,'stileWidth'),'Stile width'),target=pos(n(v,'targetPanel'),'Target panel width');let panels=Math.max(1,Math.round((L-stile)/(target+stile))),stiles=panels+1,panel=(L-stiles*stile)/panels;if(panel<=0)throw new Error('Stiles are too wide for this wall');return[R('Panels',panels),R('Stiles',stiles),R('Exact panel width',round(panel,1),'mm')]}
function checkSquare(v){const L=pos(n(v,'length'),'Length'),W=pos(n(v,'width'),'Width'),d=Math.hypot(L,W);const out=[R('Required diagonal',round(d,1),'mm')];if(Number(v.diagonalA)>0&&Number(v.diagonalB)>0){const a=n(v,'diagonalA'),b=n(v,'diagonalB');out.push(R('Diagonal difference',round(Math.abs(a-b),1),'mm'))}return out}
function diagonal(v){const a=pos(n(v,'length'),'Length'),b=pos(n(v,'width'),'Width');return[R('Diagonal',round(Math.hypot(a,b),2),'mm')]}
function triangle(v){const a=pos(n(v,'a'),'Rise / side A'),b=pos(n(v,'b'),'Run / side B'),c=Math.hypot(a,b),A=Math.atan2(a,b);return[R('Side A',round(a,2),'mm'),R('Side B',round(b,2),'mm'),R('Hypotenuse',round(c,2),'mm'),R('Angle A',round(A*180/Math.PI,2),'°'),R('Angle B',round(90-A*180/Math.PI,2),'°'),R('Area',round(a*b/2/1e6,4),'m²')]}
function generalTriangle(v){
  const clampTrig=x=>Math.max(-1,Math.min(1,x)); const angle=(key,label)=>{const d=Number(v[key]);if(!Number.isFinite(d)||d<=0||d>=180)throw new Error(`${label} must be between 0° and 180°`);return d*Math.PI/180}; const side=(key,label)=>{const x=Number(v[key]);if(!Number.isFinite(x)||x<=0)throw new Error(`${label} must be greater than 0`);return x}
  const finish=(a,b,c,A,B,C)=>{if(a+b<=c||a+c<=b||b+c<=a)throw new Error('These measurements do not form a valid triangle');return{a,b,c,A,B,C,area:.5*b*c*Math.sin(A),perimeter:a+b+c}}
  const mode=v.mode||'sss';let solutions=[]
  if(mode==='sss'){const a=side('a','Side A'),b=side('b','Side B'),c=side('c','Side C');if(a+b<=c||a+c<=b||b+c<=a)throw new Error('The three sides fail the triangle inequality');const A=Math.acos(clampTrig((b*b+c*c-a*a)/(2*b*c))),B=Math.acos(clampTrig((a*a+c*c-b*b)/(2*a*c))),C=Math.PI-A-B;solutions=[finish(a,b,c,A,B,C)]}
  else if(mode==='sas'){const a=side('a','Side A'),b=side('b','Side B'),C=angle('angleC','Angle C'),c=Math.sqrt(Math.max(0,a*a+b*b-2*a*b*Math.cos(C))),A=Math.acos(clampTrig((b*b+c*c-a*a)/(2*b*c))),B=Math.PI-A-C;solutions=[finish(a,b,c,A,B,C)]}
  else if(mode==='asa'){const A=angle('angleA','Angle A'),B=angle('angleB','Angle B'),C=Math.PI-A-B;if(C<=0)throw new Error('Angles A and B must add to less than 180°');const knownSide=String(v.knownSide||'c'),known=side('knownSideValue','Known side'),knownAngle=knownSide==='a'?A:knownSide==='b'?B:C,k=known/Math.sin(knownAngle);solutions=[finish(k*Math.sin(A),k*Math.sin(B),k*Math.sin(C),A,B,C)]}
  else if(mode==='ssa'){const a=side('a','Side A'),b=side('b','Side B'),A=angle('angleA','Angle A'),sinB=b*Math.sin(A)/a;if(sinB>1+1e-10)throw new Error('No triangle exists for these SSA measurements');const B1=Math.asin(clampTrig(sinB)),C1=Math.PI-A-B1;if(C1>1e-10)solutions.push(finish(a,b,a*Math.sin(C1)/Math.sin(A),A,B1,C1));const B2=Math.PI-B1,C2=Math.PI-A-B2;if(C2>1e-10&&Math.abs(B2-B1)>1e-8)solutions.push(finish(a,b,a*Math.sin(C2)/Math.sin(A),A,B2,C2));if(!solutions.length)throw new Error('No triangle exists for these SSA measurements')}
  else throw new Error('Unknown triangle input method')
  const selected=(mode==='ssa'&&v.ssaSolution==='second'&&solutions[1])?1:0,t=solutions[selected],d=x=>round(x*180/Math.PI,2),out=[R('Side A',round(t.a,2),'mm'),R('Side B',round(t.b,2),'mm'),R('Side C',round(t.c,2),'mm'),R('Angle A',d(t.A),'°'),R('Angle B',d(t.B),'°'),R('Angle C',d(t.C),'°'),R('Area',round(t.area,2),'mm²'),R('Perimeter',round(t.perimeter,2),'mm')]
  if(mode==='ssa'){out.unshift(R('Valid SSA solutions',solutions.length));if(solutions.length>1){const other=solutions[selected===0?1:0];out.push(R('Other solution',`B ${d(other.B)}°, C ${d(other.C)}°, side C ${round(other.c,2)} mm`))}}
  return out
}
function dumpy(v){const benchmark=n(v,'benchmark'),backsight=n(v,'backsight'),hi=benchmark+backsight,readings=String(v.readings||'').split(',').map(x=>Number(x.trim())).filter(Number.isFinite);if(!readings.length)throw new Error('Enter one or more staff readings');const rls=readings.map(x=>hi-x);return[R('Height of instrument',round(hi,3),'m'),R('Point RLs',rls.map((x,i)=>`${i+1}: ${x.toFixed(3)}`).join(' | '),'m'),R('Last point RL',round(rls.at(-1),3),'m')]}
function equalSpacing(v){const L=pos(n(v,'length'),'Overall length'),count=Math.max(1,Math.round(n(v,'count'))),width=Math.max(0,n(v,'width')),gap=(L-count*width)/(count+1);if(gap<0)throw new Error('Members do not fit');return[R('Members',count),R('Equal end/gap',round(gap,2),'mm'),R('Centre spacing',round(gap+width,2),'mm')]}
function running(v){const start=n(v,'start'),spacing=pos(n(v,'spacing'),'Spacing'),count=Math.max(1,Math.round(n(v,'count'))),marks=Array.from({length:count},(_,i)=>round(start+i*spacing,2));return[R('Running marks',marks.join(', '),'mm'),R('Last mark',marks.at(-1),'mm')]}
function arc(v){const r=pos(n(v,'radius'),'Radius'),a=pos(n(v,'angle'),'Angle')*Math.PI/180;return[R('Chord',round(2*r*Math.sin(a/2),1),'mm'),R('Rise',round(r*(1-Math.cos(a/2)),1),'mm'),R('Arc length',round(r*a,1),'mm')]}
function slope(v){const fall=n(v,'fall'),run=pos(n(v,'run'),'Run');return[R('Fall per metre',round(fall/run*1000,1),'mm/m'),R('Gradient',round(fall/run*100,2),'%'),R('Ratio',`1:${round(run/Math.abs(fall||1),2)}`)]}
function cutlist(v){const stock=pos(n(v,'stock'),'Stock'),cuts=String(v.cuts||'').split(',').map(x=>Number(x.trim())).filter(x=>x>0);if(!cuts.length)throw new Error('Enter cuts');const total=cuts.reduce((a,b)=>a+b,0);return[R('Pieces',cuts.length),R('Total cut length',round(total,1),'mm'),R('Minimum stock lengths',Math.ceil(total/stock))]}

export const calculators=[
 {id:'concrete',name:'Concrete',category:'Concrete & Groundwork',description:'Slabs, footings, post holes, columns, stairs and kerbs',visual:'concrete',fields:[s('mode','Concrete type','post-round-hole-square-post',[['slab','Slab / pad'],['strip','Strip footing'],['post-round-hole-round-post','Post hole: round hole + round post'],['post-round-hole-square-post','Post hole: round hole + square post'],['post-square-hole-round-post','Post hole: square hole + round post'],['post-square-hole-square-post','Post hole: square hole + square post'],['circular','Circular slab'],['stairs','Concrete stairs'],['kerb','Kerb + gutter'],['square-column','Square column'],['round-column','Round column']]),f('length','Length (mm)',3000,{show:m=>['slab','strip','kerb'].includes(m.mode)}),f('width','Width (mm)',1000,{show:m=>['slab','strip'].includes(m.mode)}),f('depth','Depth (mm)',100,{show:m=>['slab','strip','circular'].includes(m.mode)}),f('holeDiameter','Hole diameter (mm)',350,{show:m=>m.mode?.includes('round-hole')}),f('holeWidth','Hole width (mm)',400,{show:m=>m.mode?.includes('square-hole')}),f('holeLength','Hole length (mm)',400,{show:m=>m.mode?.includes('square-hole')}),f('holeDepth','Hole depth (mm)',600,{show:m=>m.mode?.startsWith('post-')}),f('postDiameter','Post diameter (mm)',100,{show:m=>m.mode?.includes('round-post')}),f('postWidth','Post width (mm)',100,{show:m=>m.mode?.includes('square-post')}),f('postThickness','Post thickness (mm)',100,{show:m=>m.mode?.includes('square-post')}),f('postEmbedDepth','Post embedment depth (mm, 0 = full hole depth)',0,{show:m=>m.mode?.startsWith('post-')}),f('quantity','Number of holes',1,{show:m=>m.mode?.startsWith('post-')}),f('diameter','Diameter (mm)',1000,{show:m=>['circular','round-column'].includes(m.mode)}),f('side','Column side (mm)',300,{show:m=>m.mode==='square-column'}),f('height','Height (mm)',2400,{show:m=>['square-column','round-column'].includes(m.mode)}),f('stairWidth','Stair width (mm)',1000,{show:m=>m.mode==='stairs'}),f('rise','Rise per step (mm)',180,{show:m=>m.mode==='stairs'}),f('going','Going per step (mm)',250,{show:m=>m.mode==='stairs'}),f('steps','Number of steps',4,{show:m=>m.mode==='stairs'}),f('curbWidth','Kerb width (mm)',150,{show:m=>m.mode==='kerb'}),f('curbHeight','Kerb height (mm)',300,{show:m=>m.mode==='kerb'}),f('gutterWidth','Gutter width (mm)',450,{show:m=>m.mode==='kerb'}),f('gutterDepth','Gutter depth (mm)',100,{show:m=>m.mode==='kerb'}),f('waste','Allowance / waste (%)',10),f('bagYield','Bag yield (L, optional)',0)],calc:concrete},
 {id:'gravel',name:'Gravel',category:'Concrete & Groundwork',description:'Aggregate volume, allowance and optional tonnage',fields:[f('length','Length (mm)',5000),f('width','Width (mm)',3000),f('depth','Depth (mm)',100),f('waste','Allowance (%)',10),f('density','Density kg/m³ (optional)',0)],calc:gravel},
 {id:'soil',name:'Soil',category:'Concrete & Groundwork',description:'Topsoil and fill volume',fields:[f('length','Length (mm)',4000),f('width','Width (mm)',2000),f('depth','Depth (mm)',200),f('waste','Allowance (%)',10),f('density','Density kg/m³ (optional)',0)],calc:soil},
 {id:'asphalt',name:'Asphalt',category:'Concrete & Groundwork',description:'Area, compacted volume and estimated tonnes',fields:[f('length','Length (mm)',10000),f('width','Width (mm)',3000),f('depth','Compacted depth (mm)',50),f('density','Density (kg/m³)',2400),f('compaction','Compaction / ordering factor',1.05)],calc:asphalt},
 {id:'stairs',name:'Stairs',category:'Stairs & Framing',description:'Risers, goings, tread/nosing set-out and stringer',visual:'stairs',fields:[f('totalRise','Total rise (mm)',2700),f('preferredRise','Preferred rise (mm)',180),f('going','Going / nosing-to-nosing (mm)',250),f('nosing','Tread nosing (mm)',25)],calc:stairs},
 {id:'roof',name:'Roof Pitch & Rafter',category:'Stairs & Framing',description:'Live common-rafter and birdsmouth geometry',visual:'rafter',fields:[s('mode','Input method','rise-run',[['rise-run','Rise + run'],['angle-run','Angle + run']]),f('rise','Rise (mm)',1000,{show:m=>m.mode==='rise-run'}),f('angle','Pitch angle (°)',18.435,{show:m=>m.mode==='angle-run'}),f('run','Horizontal run (mm)',3000),f('overhang','Horizontal overhang (mm)',450),f('seatCut','Birdsmouth seat / bearing (mm)',70),f('rafterDepth','Rafter depth (mm)',190),f('ridgeThickness','Ridge thickness (mm)',45)],calc:roof},
 {id:'raked-wall',name:'Raked Wall',category:'Stairs & Framing',description:'Stud lengths and centre spacing along a rake',visual:'raked',fields:[f('length','Wall length (mm)',4000),f('low','Low height (mm)',2400),f('high','High height (mm)',3400),f('spacing','Stud spacing (mm)',450)],calc:raked},
 {id:'baluster',name:'Baluster Spacing',category:'Stairs & Framing',description:'Equal end margins, actual gap and centres',visual:'baluster',fields:[f('run','Rail / section length (mm)',3000),f('width','Baluster width (mm)',40),f('maxGap','Maximum permitted clear gap (mm)',100)],calc:baluster},
 {id:'decking',name:'Decking',category:'Decking & Outdoor',description:'Boards, last-board rip, joists, bearers and screws',visual:'decking',fields:[f('length','Deck length (mm)',6000),f('width','Deck width (mm)',4000),f('boardWidth','Board width (mm)',90),f('gap','Board gap (mm)',5),f('joistSpacing','Joist spacing (mm)',450),f('bearerSpacing','Bearer spacing (mm)',1800),f('waste','Board waste (%)',10),f('screwsPerFix','Screws per board/joist fixing',2)],calc:decking},
 {id:'fence-pickets',name:'Fence Pickets',category:'Decking & Outdoor',description:'Picket count, clear gaps and centres',visual:'baluster',fields:[f('run','Fence run (mm)',6000),f('width','Picket width (mm)',75),f('maxGap','Maximum gap (mm)',20)],calc:pickets},
 {id:'wainscoting',name:'Wainscoting',category:'Decking & Outdoor',description:'Panel and stile layout',fields:[f('length','Wall length (mm)',4000),f('stileWidth','Stile width (mm)',75),f('targetPanel','Target panel width (mm)',500)],calc:wainscot},
 {id:'check-square',name:'Check Square',category:'Set-out & Measuring',description:'Required diagonal and measured comparison',visual:'square',fields:[f('length','Length (mm)',3000),f('width','Width (mm)',4000),f('diagonalA','Measured diagonal A (optional)',0),f('diagonalB','Measured diagonal B (optional)',0)],calc:checkSquare},
 {id:'diagonal',name:'Diagonal',category:'Set-out & Measuring',description:'Rectangle or square diagonal',visual:'square',fields:[f('length','Length (mm)',3000),f('width','Width (mm)',4000)],calc:diagonal},
 {id:'triangle-general',name:'General Triangle',category:'Set-out & Measuring',description:'Solve non-right triangles with SSS, SAS, ASA/AAS or SSA',visual:'triangle-general',fields:[s('mode','Known measurements','sss',[['sss','3 sides (SSS)'],['sas','2 sides + included angle (SAS)'],['asa','2 angles + 1 side (ASA / AAS)'],['ssa','2 sides + non-included angle (SSA)']]),f('a','Side A (mm)',4000,{show:m=>['sss','sas','ssa'].includes(m.mode)}),f('b','Side B (mm)',3500,{show:m=>['sss','sas','ssa'].includes(m.mode)}),f('c','Side C (mm)',5000,{show:m=>m.mode==='sss'}),f('angleC','Included angle C (°)',60,{show:m=>m.mode==='sas'}),f('angleA','Angle A (°)',50,{show:m=>['asa','ssa'].includes(m.mode)}),f('angleB','Angle B (°)',60,{show:m=>m.mode==='asa'}),s('knownSide','Known side','c',[['a','Side A'],['b','Side B'],['c','Side C']],{show:m=>m.mode==='asa'}),f('knownSideValue','Known side length (mm)',5000,{show:m=>m.mode==='asa'}),s('ssaSolution','SSA solution','first',[['first','Solution 1'],['second','Solution 2 (when available)']],{show:m=>m.mode==='ssa'})],calc:generalTriangle},
 {id:'triangle',name:'Right Triangle',category:'Set-out & Measuring',description:'Pythagoras, angles and area',visual:'triangle',fields:[f('a','Rise / side A (mm)',300),f('b','Run / side B (mm)',400)],calc:triangle},
 {id:'dumpy',name:'Dumpy Level',category:'Set-out & Measuring',description:'Benchmark, backsight and multiple staff-reading RLs',fields:[f('benchmark','Benchmark RL (m)',100),f('backsight','Backsight at benchmark (m)',1.5),t('readings','Staff readings, comma separated (m)','1.25, 1.42, 1.08')],calc:dumpy},
 {id:'equal-spacing',name:'Equal Spacing',category:'Set-out & Measuring',description:'Equal end gaps and centre spacing',visual:'baluster',fields:[f('length','Overall length (mm)',3000),f('count','Member count',6),f('width','Member width (mm)',45)],calc:equalSpacing},
 {id:'running',name:'Running Measurements',category:'Set-out & Measuring',description:'Repeated set-out marks',fields:[f('start','Start mark (mm)',0),f('spacing','Spacing (mm)',450),f('count','Number of marks',10)],calc:running},
 {id:'arc',name:'Arc',category:'Geometry',description:'Chord, rise, radius and arc length',visual:'arc',fields:[f('radius','Radius (mm)',2000),f('angle','Included angle (°)',90)],calc:arc},
 {id:'slope',name:'Slope & Fall',category:'Geometry',description:'Gradient, fall per metre and ratio',visual:'triangle',fields:[f('fall','Fall (mm)',150),f('run','Run (mm)',5000)],calc:slope},
 {id:'cut-list',name:'Linear Cut List',category:'Cutting',description:'Quick stock-length estimate',fields:[f('stock','Stock length (mm)',6000),t('cuts','Cuts, comma separated (mm)','2400, 1200, 900, 850')],calc:cutlist}
]

export const categories=[...new Set(calculators.map(c=>c.category))]
