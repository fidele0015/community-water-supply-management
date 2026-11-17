const $ = selector => document.querySelector(selector);
const collectionNames = {
  households: { title: 'Households', singular: 'household', description: 'Household details and community contact records.', fields: ['householdId', 'headName', 'village', 'householdSize', 'phone'] },
  waterSources: { title: 'Water sources', singular: 'water source', description: 'Monitor water points, storage capacity, and operational status.', fields: ['sourceId', 'name', 'village', 'sourceType', 'capacityLitres', 'availableLitres', 'operational'] },
  waterRequests: { title: 'Requests', singular: 'request', description: 'Track delivery needs, low supply reports, and repair complaints.', fields: ['requestId', 'householdId', 'village', 'litresRequested', 'requestType', 'status', 'requestedAt'] },
  deliverySchedules: { title: 'Schedules', singular: 'schedule', description: 'Plan and track delivery, tank refill, and repair visits.', fields: ['scheduleId', 'village', 'serviceDate', 'vehicle', 'teamLead', 'serviceType', 'status'] }
};
const fieldLabels = { householdId:'Household ID', headName:'Household head', village:'Village', householdSize:'Household size', phone:'Phone', sourceId:'Source ID', name:'Source name', sourceType:'Source type', capacityLitres:'Capacity (litres)', availableLitres:'Available water (litres)', operational:'Operational', requestId:'Request ID', litresRequested:'Litres requested', requestType:'Request type', status:'Status', requestedAt:'Requested at', scheduleId:'Schedule ID', serviceDate:'Service date and time', vehicle:'Vehicle', teamLead:'Team lead', serviceType:'Service type' };
const collectionIds = { households:'householdId', waterSources:'sourceId', waterRequests:'requestId', deliverySchedules:'scheduleId' };
const selectOptions = { operational:['true','false'], status:['Pending','In Progress','Completed'] };
const formState = { collection:'households', id:null, rows:[] };
let activePage = 'overview', toastTimer, deleteTarget = null;

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
function esc(value='') { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(message) { const box=$('#toast'); box.textContent=message; box.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>box.classList.remove('show'),3300); }
function humanDate(value, withTime=false) { if(!value)return '—'; const d=new Date(value); return Number.isNaN(+d)?'—':d.toLocaleString(undefined,withTime?{dateStyle:'medium',timeStyle:'short'}:{dateStyle:'medium'}); }
function statusPill(value) {
  const lower=String(value||'').toLowerCase();
  const tone=lower.includes('complet')||lower==='true'||lower==='operational'?'good':lower.includes('progress')||lower==='scheduled'?'blue':lower.includes('pending')||lower.includes('low')?'warn':lower==='false'||lower.includes('cancel')?'bad':'';
  return `<span class="pill ${tone}">${esc(value)}</span>`;
}
function nav(page) {
  activePage=page;
  document.querySelectorAll('[data-page]').forEach(link=>link.classList.toggle('active',link.dataset.page===page || (page==='overview'&&link.dataset.page==='overview')));
  const meta=collectionNames[page];
  const isOverview=page==='overview';
  const dataKey=isOverview?'waterRequests':page;
  const dataMeta=collectionNames[dataKey];
  $('#page-title').textContent=isOverview?'Overview':dataMeta.title;
  $('#breadcrumb-title').textContent=isOverview?'Overview':dataMeta.title;
  $('#page-subtitle').textContent=isOverview?'A live view of household needs, water points, and service activity.':dataMeta.description;
  $('#add-label').textContent=`Add ${isOverview?'household':dataMeta.singular}`;
  $('#stats-grid').hidden=!isOverview;
  $('#overview-detail').hidden=!isOverview;
  $('#records-panel').hidden=isOverview?false:false;
  $('#panel-title').innerHTML=`${isOverview?'Recent requests':dataMeta.title} <span class="result-count" id="result-count">0</span>`;
  $('#panel-copy').textContent=isOverview?'Track water delivery needs and system complaints.':dataMeta.description;
  $('#add-record').dataset.collection=isOverview?'households':page;
  $('#search').placeholder=`Search ${isOverview?'requests':dataMeta.title.toLowerCase()}...`;
  buildFilters(dataKey);
  loadRecords(dataKey);
}
function buildFilters(collection) {
  const hasStatus=collection==='waterRequests'||collection==='deliverySchedules';
  $('#status-filter').hidden=!hasStatus;
  $('#status-filter').innerHTML=`<option value="">Any status</option>${(collection==='waterRequests'?['Pending','In Progress','Completed']:collection==='deliverySchedules'?['Scheduled','In Progress','Completed']:[]).map(s=>`<option>${s}</option>`).join('')}`;
}
function query(collection) {
  const p=new URLSearchParams(); if($('#search').value.trim())p.set('search',$('#search').value.trim()); if($('#status-filter').value)p.set('status',$('#status-filter').value); if($('#village-filter').value)p.set('village',$('#village-filter').value);
  return `/api/${collection}?${p}`;
}
async function loadRecords(collection=activePage==='overview'?'waterRequests':activePage) {
  formState.collection=collection;
  try {
    const rows=await api(query(collection)); formState.rows=rows; renderRows(collection,rows); populateVillages(collection,rows);
    if(activePage==='overview') await loadOverview();
  } catch(error) { toast(`Couldn't load records: ${error.message}`); }
}
function populateVillages(collection, rows) {
  const select=$('#village-filter'), prior=select.value;
  const villages=[...new Set(rows.map(row=>row.village).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  select.innerHTML='<option value="">All villages</option>'+villages.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if(villages.includes(prior))select.value=prior;
}
function cellFor(collection,row,key) {
  if(key==='operational')return statusPill(row[key]?'Operational':'Offline');
  if(key==='status')return statusPill(row[key]);
  if(key==='requestedAt'||key==='serviceDate')return humanDate(row[key],key==='serviceDate');
  if(key==='capacityLitres'||key==='availableLitres'||key==='litresRequested')return `${Number(row[key]||0).toLocaleString()} L`;
  if(key==='headName'||key==='name')return `<span class="record-title">${esc(row[key])}</span>`;
  if(key==='householdId'||key==='sourceId'||key==='requestId'||key==='scheduleId')return `<span class="record-id">${esc(row[key])}</span>`;
  return esc(row[key]??'—');
}
function renderRows(collection,rows) {
  const meta=collectionNames[collection], labels=meta.fields;
  $('#table-head').innerHTML=`<tr>${labels.map(field=>`<th>${esc(fieldLabels[field].toUpperCase())}</th>`).join('')}<th></th></tr>`;
  const recordId=collectionIds[collection];
  $('#table-body').innerHTML=rows.map(row=>`<tr>${labels.map(field=>`<td>${cellFor(collection,row,field)}</td>`).join('')}<td><div class="row-actions"><button class="row-action" data-edit="${esc(row._id)}" title="Edit record" aria-label="Edit ${esc(row[recordId])}">✎</button><button class="row-action" data-delete="${esc(row._id)}" title="Delete record" aria-label="Delete ${esc(row[recordId])}">⌫</button></div></td></tr>`).join('');
  $('#result-count').textContent=rows.length; $('#footer-count').textContent=`Showing ${rows.length} ${meta.title.toLowerCase()}`;
  $('#empty-state').hidden=rows.length>0; $('#empty-state strong').textContent=`No ${meta.title.toLowerCase()} found`; $('#empty-state p').textContent='Try a different search or add your first record.';
  $('#table-head').parentElement.hidden=rows.length===0;
}
async function loadOverview() {
  const [summary,sources]=await Promise.all([api('/api/summary'),api('/api/waterSources')]);
  $('#stat-households').textContent=summary.households.toLocaleString(); $('#stat-sources').textContent=summary.sources.toLocaleString(); $('#stat-open').textContent=summary.openRequests.toLocaleString(); $('#stat-upcoming').textContent=summary.upcoming.toLocaleString(); $('#sidebar-low').textContent=summary.lowSources; $('#watch-count').textContent=summary.lowSources;
  const counts={Pending:0,'In Progress':0,Completed:0}; summary.statusCounts.forEach(x=>counts[x._id]=x.count);
  const total=Math.max(summary.requests,1);
  $('#status-chart').innerHTML=Object.entries(counts).map(([name,count])=>`<div class="status-row"><span>${name}</span><div class="status-track"><div class="status-fill ${name.toLowerCase().replace(' ','-')}" style="width:${Math.max(count/total*100,count?4:0)}%"></div></div><strong class="status-num">${count}</strong></div>`).join('');
  const low=sources.filter(s=>s.operational&&s.capacityLitres>0&&s.availableLitres/s.capacityLitres<.25);
  $('#supply-watch').innerHTML=low.length?low.map(s=>`<div class="watch-row"><div><strong>${esc(s.name)}</strong><span class="record-sub">${esc(s.village)} · ${esc(s.sourceType)}</span></div><span>${Math.round(s.availableLitres/s.capacityLitres*100)}% remaining</span></div>`).join(''):'<p class="watch-empty">All operational sources are above 25% capacity.</p>';
  renderPieChart(counts,total);
}
function renderPieChart(counts,total){
  const colors={Pending:'#f59e0b','In Progress':'#06b6d4',Completed:'#10b981'};
  let gradient='',currentPercent=0;
  const entries=Object.entries(counts);
  entries.forEach(([name,count],index)=>{
    const percent=count/total*100;
    const endPercent=currentPercent+percent;
    gradient+=`${colors[name]||'#ccc'} ${currentPercent}% ${endPercent}%${index<entries.length-1?', ':''}`;
    currentPercent=endPercent;
  });
  $('#pie-chart-visual').style.background=`conic-gradient(${gradient})`;
  $('#pie-legend').innerHTML=entries.map(([name,count])=>`<div class="legend-item"><div class="legend-color" style="background:${colors[name]||'#ccc'}"></div><span>${name} (${count})</span></div>`).join('');
}
const formLabel=key=>fieldLabels[key]||key;
function inputFor(key,row={}) {
  const value=row[key]??''; const required=key!=='requestedAt'; const requiredAttr=required?'required':'';
  if(selectOptions[key]) return `<label>${formLabel(key)}<select name="${key}" ${requiredAttr}>${selectOptions[key].map(v=>`<option value="${v}" ${String(value)===v?'selected':''}>${key==='operational'?(v==='true'?'Operational':'Offline'):v}</option>`).join('')}</select></label>`;
  if(key==='requestedAt'||key==='serviceDate') { const date=value?new Date(value):new Date(); const local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,key==='serviceDate'?16:10); return `<label>${formLabel(key)}<input name="${key}" type="${key==='serviceDate'?'datetime-local':'date'}" value="${local}" ${requiredAttr}></label>`; }
  const number=['householdSize','capacityLitres','availableLitres','litresRequested'].includes(key);
  const min=number?(key==='householdSize'||key==='litresRequested'?'1':'0'):undefined;
  const maxLen=key==='phone'?30:key==='village'?80:100;
  return `<label>${formLabel(key)}<input name="${key}" ${number?'type="number"':''} ${min?`min="${min}"`:''} ${number?'step="1"':''} maxlength="${maxLen}" value="${esc(value)}" ${requiredAttr}></label>`;
}
function openForm(collection,row=null) {
  formState.collection=collection; formState.id=row?._id||null;
  const meta=collectionNames[collection]; $('#form-title').textContent=`${row?'Edit':'Add'} ${meta.singular}`; $('#form-eyebrow').textContent=meta.title.toUpperCase(); $('#save-record').textContent=row?'Save changes':`Save ${meta.singular}`;
  $('#form-fields').className='record-dialog-fields dialog-form-grid';
  $('#form-fields').innerHTML=meta.fields.map(key=>inputFor(key,row||{})).join('');
  if(collection==='waterRequests'&&row==null) { const id=$('#form-fields [name="requestId"]'); if(id)id.placeholder='e.g. WR006'; }
  $('#record-dialog').showModal(); $('#form-fields input')?.focus();
}
$('#add-record').addEventListener('click',()=>openForm($('#add-record').dataset.collection||'households'));
$('#empty-add').addEventListener('click',()=>openForm(activePage==='overview'?'households':activePage));
$('#close-dialog').addEventListener('click',()=>$('#record-dialog').close()); $('#cancel-dialog').addEventListener('click',()=>$('#record-dialog').close());
$('#record-form').addEventListener('submit',async event=>{
  event.preventDefault(); const form=new FormData(event.currentTarget),body=Object.fromEntries(form.entries());
  for(const key of ['householdSize','capacityLitres','availableLitres','litresRequested'])if(body[key]!==undefined)body[key]=Number(body[key]);
  if(body.operational!==undefined)body.operational=body.operational==='true';
  const collection=formState.collection, method=formState.id?'PUT':'POST', url=`/api/${collection}${formState.id?'/'+formState.id:''}`;
  const button=$('#save-record');button.disabled=true;
  try { await api(url,{method,body:JSON.stringify(body)}); $('#record-dialog').close(); toast(`${collectionNames[collection].singular} ${formState.id?'updated':'added'} successfully.`); await refreshAll(); }
  catch(error) { toast(error.message); }
  finally { button.disabled=false; }
});
$('#table-body').addEventListener('click',event=>{
  const edit=event.target.closest('[data-edit]'),remove=event.target.closest('[data-delete]');
  if(edit){const row=formState.rows.find(x=>x._id===edit.dataset.edit);if(row)openForm(formState.collection,row);}
  if(remove){const row=formState.rows.find(x=>x._id===remove.dataset.delete);deleteTarget={id:remove.dataset.delete,collection:formState.collection};$('#delete-label').textContent=row?.[collectionIds[formState.collection]]||'this record';$('#delete-dialog').showModal();}
});
$('#keep-record').addEventListener('click',()=>$('#delete-dialog').close());
$('#confirm-delete').addEventListener('click',async()=>{if(!deleteTarget)return;try{await api(`/api/${deleteTarget.collection}/${deleteTarget.id}`,{method:'DELETE'});$('#delete-dialog').close();toast('Record deleted.');await refreshAll();}catch(error){toast(error.message);}});
async function refreshAll(){await loadRecords(activePage==='overview'?'waterRequests':activePage);}
document.querySelectorAll('[data-page]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();const filter=link.dataset.filter;nav(link.dataset.page);if(filter==='low')setTimeout(()=>toast('Showing water sources. Review the supply watch panel for low levels.'),0);}));
$('#search').addEventListener('input',(()=>{let timer;return()=>{clearTimeout(timer);timer=setTimeout(()=>loadRecords(activePage==='overview'?'waterRequests':activePage),220);}})());
$('#village-filter').addEventListener('change',()=>loadRecords(activePage==='overview'?'waterRequests':activePage)); $('#status-filter').addEventListener('change',()=>loadRecords(activePage==='overview'?'waterRequests':activePage)); $('#refresh').addEventListener('click',refreshAll);
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#search').focus();}});
api('/api/health').then(x=>{if(!x.ok)throw Error('MongoDB unavailable');}).catch(()=>{$('#connection').classList.add('offline');$('#connection').lastChild.textContent=' MongoDB unavailable';});
nav('overview');
