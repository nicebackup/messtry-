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
// Sign in temporarily to get the user object for resend
  auth.signInWithEmailAndPassword(email, pass).then(cred=>{
    return cred.user.sendEmailVerification().then(()=>{ auth.signOut(); toast('тЬЕ Verification email ржкрж╛ржарж╛ржирзЛ рж╣ржпрж╝рзЗржЫрзЗ! ржЗржиржмржХрзНрж╕ ржЪрзЗржХ ржХрж░рзБржиред'); });
  }).catch(err=>{ toast('тЭМ Email ржкрж╛ржарж╛ржирзЛ ржпрж╛ржпрж╝ржирж┐: '+(err.message||'')); });
}

function doRegister(){
  const name    = sanitizeInput(V('reg-name')),
        mob     = sanitizeInput(V('reg-mobile')),
        email   = sanitizeInput(V('reg-email')).toLowerCase(),
        job     = sanitizeInput(V('reg-jobid')),
        pass    = V('reg-pass'),
        room    = sanitizeInput(V('reg-room')),
        type    = document.getElementById('reg-type').value;
  const al=document.getElementById('reg-alert'), ok=document.getElementById('reg-ok');
  al.className='alert'; ok.className='alert';
  if(!name||!mob||!email||!job||!pass){
    al.textContent='тЭМ * ржЪрж┐рж╣рзНржирж┐ржд рждржерзНржп ржкрзВрж░ржг ржХрж░рзБржи!'; al.className='alert alert-danger show'; return;
  }
  if(!validName(name)){ al.textContent='тЭМ ржирж╛ржо ржХржоржкржХрзНрж╖рзЗ рзи ржЕржХрзНрж╖рж░ рж╣рждрзЗ рж╣ржмрзЗ!'; al.className='alert alert-danger show'; return; }
  if(!validMobile(mob)){ al.textContent='тЭМ рж╕ржарж┐ржХ ржорзЛржмрж╛ржЗрж▓ ржиржорзНржмрж░ ржжрж┐ржи (01XXXXXXXXX)!'; al.className='alert alert-danger show'; return; }
  if(!validEmail(email)){ al.textContent='тЭМ рж╕ржарж┐ржХ Email Address ржжрж┐ржи!'; al.className='alert alert-danger show'; return; }
  if(!validPass(pass)){ al.textContent='тЭМ ржкрж╛рж╕ржУржпрж╝рж╛рж░рзНржб ржХржоржкржХрзНрж╖рзЗ рзм ржХрзНржпрж╛рж░рзЗржХрзНржЯрж╛рж░!'; al.className='alert alert-danger show'; return; }

  // Auto-generate unique internal key from mobile number
  const uname = 'u_' + mob;

  // Check duplicate
  if(DB.users && DB.users.find(x=>x.u===uname||x.mob===mob)){
    al.textContent='тЭМ ржПржЗ ржорзЛржмрж╛ржЗрж▓ ржиржорзНржмрж░ ржжрж┐ржпрж╝рзЗ ржЗрждрж┐ржоржзрзНржпрзЗ ржЕрзНржпрж╛ржХрж╛ржЙржирзНржЯ ржЖржЫрзЗ!'; al.className='alert alert-danger show'; return;
  }

  const btn = document.querySelector('#sc-register .btn-primary');
  if(btn){ btn.disabled=true; btn.textContent='рж░рзЗржЬрж┐рж╕рзНржЯрзНрж░рзЗрж╢ржи рж╣ржЪрзНржЫрзЗ...'; }

  // Set guard flag BEFORE creating the user so that onAuthStateChanged
  // does not race us to signOut() before sendEmailVerification() fires.
  _registrationInProgress = true;

  (async ()=>{
    try {
      // Step 1 тАФ Create the Firebase Auth account
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      const user = cred.user;
      const uid  = user.uid;

      // Step 2 тАФ Send verification email IMMEDIATELY while the session
      // is fresh and the auth token is 100 % valid.
      // (RTDB writes come AFTER so nothing can race us here.)
      if(!user){ throw new Error('auth/no-current-user'); }
      await user.sendEmailVerification();

      // Step 3 тАФ Now persist the profile data to Realtime Database
      const userData = { name, mobile: mob, jobId: job, u: uname, room, type, role: 'member', createdAt: tod() };
      await firebase.database().ref('users/' + uid).set(userData);
      await firebase.database().ref('roles/' + uid).set({ role: 'member' });

      // Step 4 тАФ Mirror into local DB cache AND write directly to messData
      if(!DB.users) DB.users=[];
      const newUser = { uid, u: uname, name, mob, email, job, room, type, role:'member', joined: tod(), emailVerified: false, activeFrom: messMonthKey() };
      DB.users.push(newUser);
      const newIdx = DB.users.length - 1;
      globalRef.child('users/'+newIdx).set(newUser).catch(e=>console.error('User list sync error:',e));

      // Step 5 тАФ Show success, then sign out cleanly
      ok.textContent='тЬЕ рж░рзЗржЬрж┐рж╕рзНржЯрзНрж░рзЗрж╢ржи рж╕ржлрж▓! ржЖржкржирж╛рж░ Email ржЪрзЗржХ ржХрж░рзБржи тАФ Verification рж▓рж┐ржВржХ ржкрж╛ржарж╛ржирзЛ рж╣ржпрж╝рзЗржЫрзЗред';
      ok.className='alert alert-success show';
      al.className='alert';
      if(btn){ btn.disabled=false; btn.textContent='Register ржХрж░рзБржи'; }

      // Clear flag before signOut so onAuthStateChanged handles it normally
      _registrationInProgress = false;
      await auth.signOut();
      setTimeout(()=>showVerifyCard(email, pass), 2500);

    } catch(err){
      _registrationInProgress = false; // always reset on error
      // If account was created but email send failed, still sign out cleanly
      try{ await auth.signOut(); }catch(_){}

      let msg = 'тЭМ рж░рзЗржЬрж┐рж╕рзНржЯрзНрж░рзЗрж╢ржи ржмрзНржпрж░рзНрже!';
      if(err.code==='auth/email-already-in-use')      msg='тЭМ ржПржЗ Email ржжрж┐ржпрж╝рзЗ ржЗрждрж┐ржоржзрзНржпрзЗ ржЕрзНржпрж╛ржХрж╛ржЙржирзНржЯ ржЖржЫрзЗ!';
      else if(err.code==='auth/weak-password')         msg='тЭМ ржкрж╛рж╕ржУржпрж╝рж╛рж░рзНржб ржжрзБрж░рзНржмрж▓! ржХржоржкржХрзНрж╖рзЗ рзм ржХрзНржпрж╛рж░рзЗржХрзНржЯрж╛рж░ ржжрж┐ржиред';
      else if(err.code==='auth/network-request-failed')msg='тЭМ ржЗржирзНржЯрж╛рж░ржирзЗржЯ рж╕ржВржпрзЛржЧ ржЪрзЗржХ ржХрж░рзБржи!';
      else if(err.code==='auth/too-many-requests')     msg='тЭМ ржЕржирзЗржХ ржЪрзЗрж╖рзНржЯрж╛ рж╣ржпрж╝рзЗржЫрзЗред ржХрж┐ржЫрзБржХрзНрж╖ржг ржкрж░ ржЖржмрж╛рж░ ржЪрзЗрж╖рзНржЯрж╛ ржХрж░рзБржиред';
      al.textContent=msg; al.className='alert alert-danger show';
      if(btn){ btn.disabled=false; btn.textContent='Register ржХрж░рзБржи'; }
    }
  })();
}

function doForgot(){
  const email=V('fgt-email').trim().toLowerCase();
  const al=document.getElementById('fgt-alert'),ok=document.getElementById('fgt-ok');
  al.className='alert'; ok.className='alert';
  if(!email){ al.textContent='тЭМ Email Address ржжрж┐ржи!'; al.className='alert alert-danger show'; return; }
  if(!validEmail(email)){ al.textContent='тЭМ рж╕ржарж┐ржХ Email ржжрж┐ржи!'; al.className='alert alert-danger show'; return; }
  const btn=document.getElementById('fgt-btn');
  btn.disabled=true; btn.textContent='ржкрж╛ржарж╛ржирзЛ рж╣ржЪрзНржЫрзЗ...';
  auth.sendPasswordResetEmail(email)
    .then(()=>{
      ok.textContent='тЬЕ Reset рж▓рж┐ржВржХ ржкрж╛ржарж╛ржирзЛ рж╣ржпрж╝рзЗржЫрзЗ! ржЖржкржирж╛рж░ Email ржЪрзЗржХ ржХрж░рзБржиред';
      ok.className='alert alert-success show';
      al.className='alert';
      btn.disabled=false; btn.textContent='ЁЯУз Reset Link ржкрж╛ржарж╛ржи';
    })
    .catch(err=>{
      let msg='тЭМ Reset Email ржкрж╛ржарж╛ржирзЛ ржпрж╛ржпрж╝ржирж┐ред';
      if(err.code==='auth/user-not-found') msg='тЭМ ржПржЗ Email ржжрж┐ржпрж╝рзЗ ржХрзЛржирзЛ ржЕрзНржпрж╛ржХрж╛ржЙржирзНржЯ ржирзЗржЗред';
      if(err.code==='auth/too-many-requests') msg='тЭМ ржЕржирзЗржХржмрж╛рж░ ржЪрзЗрж╖рзНржЯрж╛ рж╣ржпрж╝рзЗржЫрзЗред ржХрж┐ржЫрзБржХрзНрж╖ржг ржкрж░ ржЖржмрж╛рж░ ржЪрзЗрж╖рзНржЯрж╛ ржХрж░рзБржиред';
      al.textContent=msg; al.className='alert alert-danger show';
      btn.disabled=false; btn.textContent='ЁЯУз Reset Link ржкрж╛ржарж╛ржи';
    });
}

function confirmLogout(){
  showModal('Logout','ржЖржкржирж┐ ржХрж┐ ржирж┐рж╢рзНржЪрж┐рждржнрж╛ржмрзЗ рж▓ржЧржЖржЙржЯ ржХрж░рждрзЗ ржЪрж╛ржи?',()=>{
    auth.signOut().then(()=>{
      CU=null;
      try{ localStorage.removeItem(LS_USER); }catch(e){}
      showSc('login');
      toast('Logout рж╕ржлрж▓');
    }).catch(()=>{ CU=null; showSc('login'); toast('Logout рж╕ржлрж▓'); });
  });
}


// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
// PASSWORD VISIBILITY TOGGLE
// тХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХРтХР
function togglePassVis(inputId, eyeId){
  const inp=document.getElementById(inputId);
  const eye=document.getElementById(eyeId);
  if(!inp) return;
  const isHidden=inp.type==='password';
  inp.type=isHidden?'text':'password';
  if(eye){
    // Switch between open and closed eye SVG
    eye.innerHTML=isHidden
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
                       }
                       
