// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
// js/auth.js
// Auth observer, login, register, logout, roles,
// save-ID helpers, password toggle
//
// Load order: AFTER db.js  BEFORE ui.js
// Depends on (all global):
//   config.js  тЖТ auth, DB, CU, LS_USER, globalRef
//   utils.js   тЖТ V(), esc(), validEmail(), validName(),
//                validMobile(), validPass(), sanitizeInput(),
//                toast(), messMonthKey(), tod()
//   db.js      тЖТ hideSplash(), _waitUntilReady()
// Calls into (async only тАФ loaded after auth.js):
//   ui.js      тЖТ showSc(), showModal()
//   home.js    тЖТ refreshHome()
//   notice.js  тЖТ showNoticePopup()
//
// NOTE: loadDB() is intentionally NOT here.
//       It lives in app.js and fires at parse time
//       in parallel with this observer registration.
// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР


// тФАтФА onAuthStateChanged тАФ Session Management тФАтФАтФАтФАтФАтФА
// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР

// Guard flag: prevents onAuthStateChanged from force-signing-out
// the newly created user before sendEmailVerification() completes.
let _registrationInProgress = false;

auth.onAuthStateChanged(fbUser=>{
  if(!fbUser){
    // Not logged in
    hideSplash();
    CU = null;
    showSc('login');
    return;
  }
  if(!fbUser.emailVerified){
    // If registration is actively in progress, do NOT sign out тАФ
    // the doRegister() function controls sign-out itself after
    // sendEmailVerification() has completed successfully.
    if(_registrationInProgress) return;
    // Logged in but email not verified
    hideSplash();
    auth.signOut();
    CU = null;
    showSc('login');
    const al = document.getElementById('login-alert');
    if(al){ al.innerHTML='тЪая╕П ржЗржорзЗржЗрж▓ ржпрж╛ржЪрж╛ржЗ ржХрж░рж╛ рж╣ржпрж╝ржирж┐ред <b>'+esc(fbUser.email)+'</b> ржЗржиржмржХрзНрж╕ ржЪрзЗржХ ржХрж░рзБржиред'; al.className='alert alert-danger show'; }
    return;
  }
  // Verified user тАФ load their RTDB profile
  const uid = fbUser.uid;
  firebase.database().ref('users/' + uid).once('value').then(snap=>{
    const userData = snap.val();
    if(!userData){
      hideSplash();
      auth.signOut(); CU=null; localStorage.removeItem('mq_authed'); showSc('login');
      const al = document.getElementById('login-alert');
      if(al){ al.textContent='тЭМ ржкрзНрж░рзЛржлрж╛ржЗрж▓ ржкрж╛ржУржпрж╝рж╛ ржпрж╛ржпрж╝ржирж┐ред Admin-ржПрж░ рж╕рж╛ржерзЗ ржпрзЛржЧрж╛ржпрзЛржЧ ржХрж░рзБржиред'; al.className='alert alert-danger show'; }
      return;
    }
    if(userData.blocked){
      hideSplash();
      auth.signOut(); CU=null; localStorage.removeItem('mq_authed'); showSc('login');
      const al = document.getElementById('login-alert');
      if(al){ al.textContent='тЭМ ржЖржкржирж╛рж░ ржЕрзНржпрж╛ржХрж╛ржЙржирзНржЯ ржмрзНрж▓ржХ ржХрж░рж╛ рж╣ржпрж╝рзЗржЫрзЗред Manager ржПрж░ рж╕рж╛ржерзЗ ржпрзЛржЧрж╛ржпрзЛржЧ ржХрж░рзБржиред'; al.className='alert alert-danger show'; }
      return;
    }
    // Check role from RTDB roles/{uid}
    firebase.database().ref('roles/' + uid).once('value').then(rsnap=>{
      const roleData = rsnap.val();
      // Sanitize: remove any extra quotes Firebase Console might have added
      let role = roleData?.role || userData.role || 'member';
      role = String(role).replace(/^\"+|\"+$/g,'').trim().toLowerCase();
      if(!['controller','manager','member'].includes(role)) role='member';

      CU = { uid, u: userData.u||uid, name: userData.name||fbUser.email, mob: userData.mobile||userData.mob||'', email: fbUser.email, job: userData.jobId||userData.job||'', room: userData.room||'', role, type: userData.type||'inside', joined: userData.createdAt||userData.joined||tod(), emailVerified: true };

      // Sync CU into DB.users array so role checks & meal data work correctly
      if(DB.users){
        const idx = DB.users.findIndex(x=>x.uid===uid||x.u===CU.u);
        if(idx>=0){
          // тЬЕ FIX: users/{uid} ржерзЗржХрзЗ рж╢рзБржзрзБ auth fields ржирж╛ржУред
          // name, room, job, mob, balance рж╕ржмрж╕ржоржпрж╝ messData/users ржерзЗржХрзЗ рж░рж╛ржЦрзЛред
          // ржирж╛ рж╣рж▓рзЗ profile edit ржмрж╛ deposit refresh-ржП ржкрзБрж░ржирзЛ рж╣ржпрж╝рзЗ ржпрж╛ржпрж╝ред
          DB.users[idx].uid           = uid;
          DB.users[idx].role          = role;
          DB.users[idx].emailVerified = true;
          // CU-рждрзЗ messData-ржПрж░ рж╕ржарж┐ржХ data рж░рж╛ржЦрзЛ
          CU.name       = DB.users[idx].name       || CU.name;
          CU.mob        = DB.users[idx].mob        || CU.mob;
          CU.room       = DB.users[idx].room       || CU.room;
          CU.job        = DB.users[idx].job        || CU.job;
          CU.address    = DB.users[idx].address    || '';
          CU.prevBalance= DB.users[idx].prevBalance!== undefined ? DB.users[idx].prevBalance : 0;
          CU.type       = DB.users[idx].type       || CU.type;
          CU.blocked    = DB.users[idx].blocked    || false;
        } else {
          // DB ржПржЦржирзЛ load рж╣ржпрж╝ржирж┐ тАФ _waitUntilReady-рждрзЗ sync ржХрж░рж╛ рж╣ржмрзЗ
          // ржПржЦрж╛ржирзЗ push ржХрж░рж▓рзЗ balance=0 ржжрж┐ржпрж╝рзЗ overwrite рж╣ржУржпрж╝рж╛рж░ risk ржЖржЫрзЗ, рждрж╛ржЗ skip
        }
      }
      // Also fix role in RTDB if it had extra quotes
      if(roleData?.role !== role){
        firebase.database().ref('roles/'+uid).set({role}).catch(()=>{});
        firebase.database().ref('users/'+uid+'/role').set(role).catch(()=>{});
      }

      _waitUntilReady(()=>{
        // тЬЕ DB load рж╣ржУржпрж╝рж╛рж░ ржкрж░ CU рж╕ржарж┐ржХржнрж╛ржмрзЗ sync ржХрж░рзЛ
        const syncIdx = DB.users.findIndex(x=>x.uid===uid||x.u===CU.u);
        if(syncIdx>=0){
          DB.users[syncIdx].uid           = uid;
          DB.users[syncIdx].role          = role;
          DB.users[syncIdx].emailVerified = true;
          CU.name       = DB.users[syncIdx].name        || CU.name;
          CU.mob        = DB.users[syncIdx].mob         || CU.mob;
          CU.room       = DB.users[syncIdx].room        || CU.room;
          CU.job        = DB.users[syncIdx].job         || CU.job;
          CU.prevBalance= DB.users[syncIdx].prevBalance !== undefined ? DB.users[syncIdx].prevBalance : 0;
          CU.type       = DB.users[syncIdx].type        || CU.type;
        }
        hideSplash();
        refreshHome(); showSc('home');
        localStorage.setItem('mq_authed','1'); // returning user flag
        setTimeout(()=>showNoticePopup(), 800);
      });
    });
  }).catch(err=>{
    hideSplash();
    console.error('RTDB profile load error:', err);
    auth.signOut(); CU=null; localStorage.removeItem('mq_authed'); showSc('login');
  });
});


// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
// ROLE HELPERS
// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
// Sync check тАФ uses CU.role (already loaded from RTDB on login)
function isController(u){ u=u||CU; return u&&(u.role==='controller'||(DB.controllers&&DB.controllers.includes(u.u))); }
function isManager(u){ u=u||CU; return u&&(u.role==='manager'||u.role==='controller'||isController(u)); }
function isManagerOrCtrl(u){ return isManager(u)||isController(u); }

// Async RTDB role check (use when real-time accuracy needed)
function checkRoleFromRTDB(uid){
  if(!uid) return Promise.resolve('member');
  return firebase.database().ref('roles/'+uid).once('value').then(snap=>{ const d=snap.val(); return d?.role||'member'; });
}

function roleLabel(r,u){
  if(u&&isController(u)) return 'тнР Controller';
  if(r==='controller') return 'тнР Controller';
  if(r==='manager') return 'ЁЯСС Manager';
  return 'ЁЯСд Member';
}


// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
// SAVE ID тАФ Email auto-save in login box
// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
const LS_SAVED_EMAIL = 'mq_saved_email';

function initSaveId(){
  const saved = localStorage.getItem(LS_SAVED_EMAIL);
  if(saved){
    const inp = document.getElementById('login-user');
    if(inp) inp.value = saved;
    setSaveIdChecked(true);
  }
}

function setSaveIdChecked(checked){
  const box  = document.getElementById('save-id-box');
  const tick = document.getElementById('save-id-tick');
  const lbl  = document.getElementById('save-id-label');
  if(!box) return;
  if(checked){
    box.style.background      = 'var(--primary)';
    box.style.borderColor     = 'var(--primary)';
    lbl.style.borderColor     = 'var(--primary)';
    lbl.style.background      = 'rgba(var(--primary-rgb,33,150,243),.08)';
    if(tick) tick.style.display = 'block';
  } else {
    box.style.background      = '#fff';
    box.style.borderColor     = 'var(--border)';
    lbl.style.borderColor     = 'var(--border)';
    lbl.style.background      = 'var(--bg)';
    if(tick) tick.style.display = 'none';
  }
}

function toggleSaveId(){
  const saved = localStorage.getItem(LS_SAVED_EMAIL);
  const inp   = document.getElementById('login-user');
  if(saved){
    // Currently checked тЖТ uncheck: clear storage and clear input
    localStorage.removeItem(LS_SAVED_EMAIL);
    if(inp) inp.value = '';
    setSaveIdChecked(false);
  } else {
    // Currently unchecked тЖТ check: save current email
    const email = inp ? inp.value.trim() : '';
    if(email){
      localStorage.setItem(LS_SAVED_EMAIL, email);
      setSaveIdChecked(true);
    } else {
      // No email typed yet тАФ just visually enable, will save on next login
      setSaveIdChecked(true);
    }
  }
}

function onLoginEmailInput(){
  // If Save ID is active, keep the stored value in sync as user types
  if(localStorage.getItem(LS_SAVED_EMAIL) !== null){
    const inp = document.getElementById('login-user');
    const val = inp ? inp.value.trim() : '';
    if(val){
      localStorage.setItem(LS_SAVED_EMAIL, val);
    } else {
      localStorage.removeItem(LS_SAVED_EMAIL);
      setSaveIdChecked(false);
    }
  }
}


// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
// AUTH
// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
function doLogin(){
  const email = V('login-user').trim().toLowerCase();
  const pass = V('login-pass');
  const al = document.getElementById('login-alert');
  al.className = 'alert';
  if(!email || !pass){ al.textContent='тЭМ Email ржПржмржВ ржкрж╛рж╕ржУржпрж╝рж╛рж░рзНржб ржжрж┐ржи!'; al.className='alert alert-danger show'; return; }
  if(!validEmail(email)){ al.textContent='тЭМ рж╕ржарж┐ржХ Email Address ржжрж┐ржи!'; al.className='alert alert-danger show'; return; }
  const btn = document.querySelector('#sc-login .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='рж▓ржЧржЗржи рж╣ржЪрзНржЫрзЗ...'; }

  // Firebase Persistence: LOCAL or SESSION
  const persistence = document.getElementById('remember-me').checked
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;

  auth.setPersistence(persistence).then(()=>{
    return auth.signInWithEmailAndPassword(email, pass);
  }).then(cred=>{
    const fbUser = cred.user;
    if(!fbUser.emailVerified){
      // Block unverified users тАФ show resend button
      auth.signOut();
      al.innerHTML = `тЭМ ржЗржорзЗржЗрж▓ ржпрж╛ржЪрж╛ржЗ ржХрж░рж╛ рж╣ржпрж╝ржирж┐! ржЖржкржирж╛рж░ <b>${esc(email)}</b> ржЗржиржмржХрзНрж╕ ржЪрзЗржХ ржХрж░рзБржиред<br>
        <button onclick="resendVerificationEmail('${esc(email)}','${esc(pass)}')" style="margin-top:10px;background:var(--primary);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;width:100%">
          ЁЯУз Verification Email ржкрзБржирж░рж╛ржпрж╝ ржкрж╛ржарж╛ржи
        </button>`;
      al.className='alert alert-danger show';
      if(btn){ btn.disabled=false; btn.textContent='Login ржХрж░рзБржи'; }
      return;
    }
    // Find user in RTDB by uid
    const uid = fbUser.uid;
    const userRef = firebase.database().ref('users/' + uid);
    userRef.once('value').then(snap=>{
      const userData = snap.val();
      if(!userData){ al.textContent='тЭМ RTDB-рждрзЗ ржЖржкржирж╛рж░ ржкрзНрж░рзЛржлрж╛ржЗрж▓ ржкрж╛ржУржпрж╝рж╛ ржпрж╛ржпрж╝ржирж┐ред Admin ржПрж░ рж╕рж╛ржерзЗ ржпрзЛржЧрж╛ржпрзЛржЧ ржХрж░рзБржиред'; al.className='alert alert-danger show'; auth.signOut(); if(btn){ btn.disabled=false; btn.textContent='Login ржХрж░рзБржи'; } return; }
      if(userData.blocked){ al.textContent='тЭМ ржЖржкржирж╛рж░ ржЕрзНржпрж╛ржХрж╛ржЙржирзНржЯ ржмрзНрж▓ржХ ржХрж░рж╛ рж╣ржпрж╝рзЗржЫрзЗред Manager ржПрж░ рж╕рж╛ржерзЗ ржпрзЛржЧрж╛ржпрзЛржЧ ржХрж░рзБржиред'; al.className='alert alert-danger show'; auth.signOut(); if(btn){ btn.disabled=false; btn.textContent='Login ржХрж░рзБржи'; } return; }
      // Load role from roles/{uid} and sanitize (remove any accidental extra quotes)
      firebase.database().ref('roles/'+uid).once('value').then(rsnap=>{
        const roleData = rsnap.val();
        let role = roleData?.role || userData.role || 'member';
        role = String(role).replace(/^\"+|\"+$/g,'').trim().toLowerCase();
        if(!['controller','manager','member'].includes(role)) role='member';
        CU = { uid, u: userData.u||uid, name: userData.name, mob: userData.mobile||userData.mob||'', email: fbUser.email, job: userData.jobId||userData.job||'', room: userData.room||'', role, type: userData.type||'inside', joined: userData.createdAt||userData.joined||tod(), emailVerified: true };
        // Sync into DB.users so meal/bazar/role checks work
        if(DB.users){
          const idx=DB.users.findIndex(x=>x.uid===uid||x.u===CU.u);
          if(idx>=0){
            // тЬЕ FIX: рж╢рзБржзрзБ auth fields copy ржХрж░рзЛ тАФ profile ржУ balance messData ржерзЗржХрзЗ ржирж╛ржУ
            DB.users[idx].uid           = uid;
            DB.users[idx].role          = role;
            DB.users[idx].emailVerified = true;
            CU.name       = DB.users[idx].name        || CU.name;
            CU.mob        = DB.users[idx].mob         || CU.mob;
            CU.room       = DB.users[idx].room        || CU.room;
            CU.job        = DB.users[idx].job         || CU.job;
            CU.prevBalance= DB.users[idx].prevBalance !== undefined ? DB.users[idx].prevBalance : 0;
            CU.type       = DB.users[idx].type        || CU.type;
          } else {
            DB.users.push({...CU});
            const ni = DB.users.length-1;
            globalRef.child('users/'+ni).set({...CU}).catch(()=>{});
          }
        }
        // Auto-fix bad role value in RTDB if needed
        if(roleData?.role !== role){ firebase.database().ref('roles/'+uid).set({role}).catch(()=>{}); firebase.database().ref('users/'+uid+'/role').set(role).catch(()=>{}); }
        if(btn){ btn.disabled=false; btn.textContent='Login ржХрж░рзБржи'; }
        _waitUntilReady(()=>{
          // тЬЕ DB load рж╣ржУржпрж╝рж╛рж░ ржкрж░ CU ржЖржмрж╛рж░ sync
          const si=DB.users.findIndex(x=>x.uid===uid||x.u===CU.u);
          if(si>=0){
            DB.users[si].uid=uid; DB.users[si].role=role;
            CU.prevBalance= DB.users[si].prevBalance !== undefined ? DB.users[si].prevBalance : 0;
            CU.name = DB.users[si].name || CU.name;
            CU.room = DB.users[si].room || CU.room;
            CU.job  = DB.users[si].job  || CU.job;
          }
          refreshHome(); showSc('home');
          setTimeout(()=>showNoticePopup(), 600);
        });
      });
    }).catch(err=>{ al.textContent='тЭМ ржбрзЗржЯрж╛ рж▓рзЛржб ржмрзНржпрж░рзНрже: '+err.message; al.className='alert alert-danger show'; if(btn){ btn.disabled=false; btn.textContent='Login ржХрж░рзБржи'; } });
  }).catch(err=>{
    let msg = 'тЪая╕П Login failed. Please try again.';
    if(err.code==='auth/user-not-found'||err.code==='auth/wrong-password'||err.code==='auth/invalid-credential')
      msg='тЬЧ Incorrect email or password.';
    else if(err.code==='auth/invalid-email')
      msg='тЬЧ Invalid email address format.';
    else if(err.code==='auth/too-many-requests')
      msg='тЪая╕П Too many failed attempts. Please wait and try again.';
    else if(err.code==='auth/network-request-failed')
      msg='тЬЧ No internet connection. Please check your network.';
    al.textContent = msg; al.className='alert alert-danger show';
    if(btn){ btn.disabled=false; btn.textContent='Login ржХрж░рзБржи'; }
  });
}

// Stored temporarily so doResendFromCard() can re-sign-in
let _verifyEmail = '', _verifyPass = '';

function showVerifyCard(email, pass){
  _verifyEmail = email;
  _verifyPass  = pass;
  // Switch to login screen first
  showSc('login');
  // Clear normal login-alert (we have a better card now)
  const la = document.getElementById('login-alert');
  if(la){ la.className='alert'; la.textContent=''; }
  // Pre-fill login email for convenience
  const lu = document.getElementById('login-user');
  if(lu) lu.value = email;
  // Show the card and populate email display
  const card = document.getElementById('verify-card');
  const disp = document.getElementById('verify-email-display');
  const msg  = document.getElementById('resend-msg');
  if(disp) disp.textContent = email;
  if(msg)  msg.textContent  = '';
  const resendBtn = document.getElementById('resend-btn');
  if(resendBtn){ resendBtn.disabled=false; resendBtn.textContent='ЁЯФД ржкрзБржирж░рж╛ржпрж╝ Verification ржЗржорзЗржЗрж▓ ржкрж╛ржарж╛ржи'; }
  if(card) card.style.display='block';
}

function doResendFromCard(){
  if(!_verifyEmail || !_verifyPass){
    toast('тЭМ рждржерзНржп ржкрж╛ржУржпрж╝рж╛ ржпрж╛ржпрж╝ржирж┐, ржЖржмрж╛рж░ рж░рзЗржЬрж┐рж╕рзНржЯрзНрж░рзЗрж╢ржи ржкрзЗржЬрзЗ ржЪрзЗрж╖рзНржЯрж╛ ржХрж░рзБржиред');
    return;
  }
  const btn = document.getElementById('resend-btn');
  const msg = document.getElementById('resend-msg');
  if(btn){ btn.disabled=true; btn.textContent='ржкрж╛ржарж╛ржирзЛ рж╣ржЪрзНржЫрзЗ...'; }
  if(msg){ msg.textContent=''; msg.style.color='#4CAF50'; }

  _registrationInProgress = true; // guard against onAuthStateChanged sign-out
  auth.signInWithEmailAndPassword(_verifyEmail, _verifyPass)
    .then(cred => cred.user.sendEmailVerification())
    .then(()=>{
      _registrationInProgress = false;
      return auth.signOut();
    })
    .then(()=>{
      if(btn){ btn.disabled=false; btn.textContent='ЁЯФД ржкрзБржирж░рж╛ржпрж╝ Verification ржЗржорзЗржЗрж▓ ржкрж╛ржарж╛ржи'; }
      if(msg){ msg.textContent='тЬЕ ржЗржорзЗржЗрж▓ ржкрж╛ржарж╛ржирзЛ рж╣ржпрж╝рзЗржЫрзЗ! ржЗржиржмржХрзНрж╕ ржУ Spam ржлрзЛрж▓рзНржбрж╛рж░ ржЪрзЗржХ ржХрж░рзБржиред'; }
    })
    .catch(err=>{
      _registrationInProgress = false;
      auth.signOut().catch(()=>{});
      if(btn){ btn.disabled=false; btn.textContent='ЁЯФД ржкрзБржирж░рж╛ржпрж╝ Verification ржЗржорзЗржЗрж▓ ржкрж╛ржарж╛ржи'; }
      let emsg = 'тЭМ ржкрж╛ржарж╛ржирзЛ ржпрж╛ржпрж╝ржирж┐ред';
      if(err.code==='auth/too-many-requests') emsg='тЭМ ржЕржирзЗржХржмрж╛рж░ ржЪрзЗрж╖рзНржЯрж╛ рж╣ржпрж╝рзЗржЫрзЗред ржХрж┐ржЫрзБржХрзНрж╖ржг ржкрж░ ржЖржмрж╛рж░ ржЪрзЗрж╖рзНржЯрж╛ ржХрж░рзБржиред';
      if(err.code==='auth/wrong-password')    emsg='тЭМ ржкрж╛рж╕ржУржпрж╝рж╛рж░рзНржб ржорж┐рж▓ржЫрзЗ ржирж╛ред';
      if(msg){ msg.textContent=emsg; msg.style.color='#e53935'; }
    });
}

function resendVerificationEmail(email, pass){
  // Sign in temporarily to ge
