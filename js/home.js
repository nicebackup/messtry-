// ═══════════════════════════════════════════════
// js/home.js
// Home screen render, date nav, meal history modal,
// who-eats system (full-page grid + PDF export)
//
// Load order: AFTER main inline script (toast, mTV, calcMealRate etc.)
//             BEFORE js/auth.js
//
// Depends on (all global):
//   config.js       → DB, CU
//   utils.js        → tod(), messMonthKey(), messMonthLabel(),
//                     dateInMessMonth(), safeHTML(), esc()
//   core.js         → homeViewDate (var — NOT redeclared here),
//                     fmtDate(), isActiveInMonth()
//   inline script   → toast(), toISODate(), mTV(), getCfg(),
//                     messMonthMeals(), calcMealRate()
//   auth.js         → roleLabel(), isManagerOrCtrl()  [async-safe]
//   ui.js           → sec(), goHome()                 [async-safe]
//   CDN jspdf       → window.jspdf                    [head tag]
//
// NOTE: homeViewDate is intentionally NOT declared here.
//       It lives in js/shared/core.js as `var homeViewDate`
//       (window-scoped). Re-declaring it here would create a
//       separate script-file-scoped binding and break the
//       shared state between ui.js (goHome) and home.js.
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════
// Home page browsing date (separate from real today)
// Declared in js/shared/core.js as var homeViewDate (global scope)

function homeShiftDate(delta){
  const realToday = tod();
  const base = homeViewDate || realToday;
  const d = new Date(base); d.setDate(d.getDate()+delta);
  const newDate = toISODate(d);
  homeViewDate = newDate;
  refreshHome();
}


function refreshHome(){
  if(!CU) return;
  document.getElementById('home-date').textContent=(CU.name||'')+(CU.job?' · '+CU.job:'');
  document.getElementById('home-role').textContent=roleLabel(CU.role,CU);
  document.getElementById('home-mgr').textContent=DB.siteNote||'Midland East Power Limited';

  // Always use real today for stats
  const realToday = tod();
  // For display, use homeViewDate if set, else real today
  const viewDate = homeViewDate || realToday;
  const isToday = (viewDate === realToday);

  // Date display
  const days=['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  const vd = new Date(viewDate+'T00:00:00');
  document.getElementById('td-date').textContent='তারিখ: '+fmtDate(viewDate);
  document.getElementById('td-day').textContent=days[vd.getDay()];

  // Nav label
  const navLbl = document.getElementById('td-nav-label');
  if(navLbl) navLbl.textContent = isToday ? '🟢 আজকের তথ্য দেখছেন' : '📅 '+viewDate+' এর তথ্য দেখছেন';

  // Always show next button active (future browsing allowed)
  const nextBtn = document.getElementById('td-next-btn');
  if(nextBtn) nextBtn.style.opacity = '1';

  // Meal counts for viewDate
  let tb=0,tl=0,tdv=0, cbQ=0,clQ=0,cdQ=0;
  DB.users.filter(u=>!u.blocked).forEach(u=>{
    const m=DB.meals[u.u+'_'+viewDate]||{b:{t:'off',q:1},l:{t:'off',q:1},d:{t:'off',q:1}};
    tb+=mTV('b',m.b,viewDate,u.type); tl+=mTV('l',m.l,viewDate,u.type); tdv+=mTV('d',m.d,viewDate,u.type);
    if(m.b&&m.b.t!=='off') cbQ+=(m.b.q||1);
    if(m.l&&m.l.t!=='off') clQ+=(m.l.q||1);
    if(m.d&&m.d.t!=='off') cdQ+=(m.d.q||1);
  });
  document.getElementById('td-b').textContent=cbQ;
  document.getElementById('td-l').textContent=clQ;
  document.getElementById('td-d').textContent=cdQ;
  document.getElementById('td-total').textContent=(tb+tl+tdv).toFixed(2);

  // Stats always use real today's mess month
  const mKey=messMonthKey();
  const mTotal=messMonthMeals(CU.u,mKey);
  document.getElementById('st-month').textContent=mTotal.toFixed(2);
  const {pm}=calcMealRate(mKey);
  document.getElementById('st-bill').textContent='৳ '+pm.toFixed(2);

  // Show/hide manager-only buttons
  const mgr=isManagerOrCtrl();
  document.getElementById('menu-bazar').style.display='block';
  document.getElementById('menu-bazar').querySelector('.menu-sub').textContent=mgr?'Bazar Entry':'ইতিহাস দেখুন';
  document.getElementById('menu-others').style.display='block';
  document.getElementById('menu-others').querySelector('.menu-sub').textContent=mgr?'Others Expense':'ইতিহাস দেখুন';
  const omEl=document.getElementById('menu-officemeal');
  if(omEl) omEl.style.display=mgr?'block':'none';
  document.getElementById('menu-deposit').style.display='block';
  document.getElementById('admin-btn').style.display=isManagerOrCtrl()?'block':'none';
  const rulesEl=document.getElementById('menu-rules');
  if(rulesEl) rulesEl.style.display=isManagerOrCtrl()?'block':'none';

  // Auto-reset to today every time goHome is called fresh
  if(!homeViewDate) homeViewDate=null;
}

// ═══════════════════════════════════════════════
// MEAL HISTORY MODAL (এই মাসের মিল card click)
// ═══════════════════════════════════════════════
function showMyMealHistory(){
  if(!CU) return;
  const mmKey=messMonthKey();
  const {pm}=calcMealRate(mmKey);
  const modal=document.getElementById('meal-hist-modal');
  const body=document.getElementById('meal-hist-body');

  // Collect all dates in this mess month for this user
  const dates=[];
  Object.keys(DB.meals).forEach(k=>{
    if(!k.startsWith(CU.u+'_')) return;
    const dateStr=k.slice(CU.u.length+1);
    if(dateInMessMonth(dateStr,mmKey)) dates.push(dateStr);
  });
  dates.sort();

  const monthLabel=messMonthLabel();
  let html=`<div style="font-size:12px;color:var(--text-light);margin-bottom:10px">${monthLabel}</div>`;

  if(!dates.length){
    html+='<p class="muted tc" style="padding:20px 0">এই মাসে কোনো মিল নেই</p>';
  } else {
    let grand=0;
    html+=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--primary);color:#fff">
        <th style="padding:8px 6px;text-align:left;font-weight:600">তারিখ</th>
        <th style="text-align:center;padding:8px 4px">সকাল</th>
        <th style="text-align:center;padding:8px 4px">দুপুর</th>
        <th style="text-align:center;padding:8px 4px">রাত</th>
        <th style="text-align:right;padding:8px 6px">মোট</th>
      </tr></thead><tbody>`;
    dates.forEach((d,ri)=>{
      const meal=DB.meals[CU.u+'_'+d]||{b:{t:'off',q:1},l:{t:'off',q:1},d:{t:'off',q:1}};
      const bv=mTV('b',meal.b,d,CU&&CU.type), lv=mTV('l',meal.l,d,CU&&CU.type), dv=mTV('d',meal.d,d,CU&&CU.type);
      grand+=bv+lv+dv;
      const fmtCell=(mv,slot_m)=>{
        if(!slot_m||slot_m.t==='off') return `<td style="text-align:center;color:var(--text-light);padding:7px 4px;font-size:11px">—</td>`;
        const lbl=slot_m.t+((slot_m.q||1)>1?(slot_m.q||1):'');
        const c=slot_m.t==='P'?'var(--success)':'var(--info)';
        return `<td style="text-align:center;padding:7px 4px"><span style="color:${c};font-weight:700;font-size:12px">${lbl}</span></td>`;
      };
      const bg=ri%2===0?'var(--bg)':'transparent';
      html+=`<tr style="background:${bg};border-top:1px solid var(--border)">
        <td style="padding:7px 6px;font-size:12px;color:var(--text-light)">${d.slice(8)+'/'+d.slice(5,7)}</td>
        ${fmtCell(bv,meal.b)}${fmtCell(lv,meal.l)}${fmtCell(dv,meal.d)}
        <td style="text-align:right;padding:7px 6px;font-weight:700;color:var(--primary)">${(bv+lv+dv).toFixed(2)}</td>
      </tr>`;
    });
    html+=`</tbody><tfoot><tr style="background:var(--primary);color:#fff;font-weight:700">
      <td colspan="4" style="padding:8px 6px">সর্বমোট</td>
      <td style="text-align:right;padding:8px 6px">${grand.toFixed(2)}</td>
    </tr></tfoot></table></div>`;
    // Bill estimate
    html+=`<div style="margin-top:14px;padding:12px;background:var(--success-light);border-radius:10px;border:1px solid #c8e6c9">
      <div style="font-size:12px;color:var(--text-light)">আনুমানিক মিল বিল (রেট ৳${pm.toFixed(2)})</div>
      <div style="font-size:20px;font-weight:700;color:var(--success);margin-top:4px">৳ ${(grand*pm).toFixed(2)}</div>
    </div>`;
  }
  body.innerHTML = safeHTML(html);
  modal.classList.add('show');
}

// ═══════════════════════════════════════════════
// WHO EATS — Full page (ID grid view)
// ═══════════════════════════════════════════════
let _weSlot = 'b';   // b=সকাল l=দুপুর d=রাত
let _weDate = '';
let _weView = 'P';   // P=Plant  Q=Quarter
let _wePlanters = [];
let _weQtr = [];

const WE_SLOT_LABELS = { b:'সকাল', l:'দুপুর', d:'রাত' };

function showWhoEatsDate(slot){
  _weDate = homeViewDate || tod();
  _weSlot = slot;
  _weView = 'P';
  _collectWeData();
  _renderWeHeader();
  _renderWeGrid();
  sec('whoeats');
}
function showWhoEatsOnDate(slot, dateStr){
  _weDate = dateStr;
  _weSlot = slot;
  _weView = 'P';
  _collectWeData();
  _renderWeHeader();
  _renderWeGrid();
  sec('whoeats');
}
function showWhoEats(slot){ showWhoEatsDate(slot); }

function setWeView(v){
  _weView = v;
  // Toggle button styles
  const bp = document.getElementById('we-tog-p');
  const bq = document.getElementById('we-tog-q');
  if(v==='P'){
    bp.style.color='var(--primary)'; bp.style.borderBottom='3px solid var(--primary)'; bp.style.fontWeight='700';
    bq.style.color='var(--text-light)'; bq.style.borderBottom='3px solid transparent'; bq.style.fontWeight='600';
  } else {
    bq.style.color='var(--info)'; bq.style.borderBottom='3px solid var(--info)'; bq.style.fontWeight='700';
    bp.style.color='var(--text-light)'; bp.style.borderBottom='3px solid transparent'; bp.style.fontWeight='600';
  }
  _renderWeGrid();
}

function _collectWeData(){
  _wePlanters = [];
  _weQtr = [];
  (DB.users||[]).filter(u=>!u.blocked).forEach(u=>{
    const m = (DB.meals||{})[u.u+'_'+_weDate];
    if(!m || !m[_weSlot] || m[_weSlot].t==='off') return;
    const qty = m[_weSlot].q || 1;
    if(m[_weSlot].t==='P') _wePlanters.push({u, qty});
    if(m[_weSlot].t==='Q') _weQtr.push({u, qty});
  });
  const _sortById=(a,b)=>{
    const na=parseFloat(a.u.job||a.u.u), nb=parseFloat(b.u.job||b.u.u);
    if(!isNaN(na)&&!isNaN(nb)) return na-nb;
    return String(a.u.job||a.u.u).localeCompare(String(b.u.job||b.u.u));
  };
  _wePlanters.sort(_sortById);
  _weQtr.sort(_sortById);
}

function _renderWeHeader(){
  const days=['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  const d = new Date(_weDate+'T00:00:00');
  document.getElementById('we-slot-lbl').textContent = WE_SLOT_LABELS[_weSlot] || '';
  document.getElementById('we-date-lbl').textContent = fmtDate(_weDate);
  document.getElementById('we-day-lbl').textContent  = days[d.getDay()];
}

function _renderWeGrid(){
  const list  = _weView==='P' ? _wePlanters : _weQtr;
  const color = _weView==='P' ? 'var(--success)' : 'var(--info)';
  const lbl   = _weView==='P' ? 'প্ল্যান্টে খাবে' : 'কোয়ার্টারে খাবে';
  const grid  = document.getElementById('we-view-grid');
  const empty = document.getElementById('we-empty');
  const vlbl  = document.getElementById('we-view-lbl');
  const vtot  = document.getElementById('we-view-total');

  vlbl.textContent  = lbl;
  vlbl.style.color  = color;

  if(!list.length){
    grid.innerHTML = '';
    vtot.textContent = '';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';
  const total = list.reduce((a,e)=>a+e.qty,0);
  vtot.textContent = 'মোট: '+total+' মিল';

  grid.innerHTML = list.map(entry=>{
    const id  = entry.u.job || entry.u.u;
    const lbl = entry.qty>1 ? id+'-P'+entry.qty : String(id);
    return '<div style="background:var(--bg);border:1.5px solid '+color+';border-radius:7px;'+
           'padding:7px 4px;text-align:center;font-size:13px;font-weight:700;color:'+color+';'+
           'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(lbl)+'</div>';
  }).join('');
}


// ── PDF Export (Plant only, 3-column grid, A4) ──
function exportWhoEatsPDF(){
  if(!_wePlanters.length){ toast('এই বেলায় প্ল্যান্টে কেউ নেই'); return; }
  const {jsPDF} = window.jspdf;
  if(!jsPDF){ toast('PDF লাইব্রেরি লোড হয়নি'); return; }

  const doc  = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  const mL=15, mR=195, mT=15;
  const slotBn  = WE_SLOT_LABELS[_weSlot] || _weSlot;
  const slotMap = {b:'Morning', l:'Lunch', d:'Night'};
  const slotAsc = slotMap[_weSlot] || _weSlot;

  // ── Title block ──
  doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text(slotAsc+' Meals @ Plant', 105, mT+6, {align:'center'});
  doc.setFontSize(11); doc.setFont('helvetica','normal');
  doc.text('('+fmtDate(_weDate)+')', 105, mT+13, {align:'center'});

  // ── Horizontal rule ──
  let y = mT+18;
  doc.setDrawColor(150); doc.setLineWidth(0.4);
  doc.line(mL, y, mR, y); y+=6;

  // ── 3-column grid of IDs ──
  const colW = (mR-mL)/3;
  doc.setFontSize(12); doc.setFont('helvetica','bold');
  const ids = _wePlanters.map(e=>{
    const id = e.u.job || e.u.u;
    return e.qty>1 ? id+'-P'+e.qty : String(id);
  });

  for(let i=0; i<ids.length; i++){
    const col = i%3;
    const x   = mL + col*colW + colW/2;
    doc.text(ids[i], x, y, {align:'center'});
    if(col===2 || i===ids.length-1){ y+=8; }
    if(y>270){ doc.addPage(); y=mT; }
  }

  // ── Footer ──
  y+=4;
  doc.setDrawColor(100); doc.setLineWidth(0.5);
  doc.line(mL, y, mR, y); y+=7;
  const total = _wePlanters.reduce((a,e)=>a+e.qty,0);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Total: '+total+' Meals', 105, y, {align:'center'});

  doc.save(slotAsc+'@Plant_'+fmtDate(_weDate)+'.pdf');
  toast('PDF ডাউনলোড হচ্ছে!');
}

function closeWhoEats(){ goHome(); }
