// ═══════════════════════════════════════════════
// js/approval.js
// Registration Approval System
//
// Flow: Register → Email Verify → Pending → Controller Approve → Member
//
// Firebase paths:
//   pendingApprovals/{uid}  → pending user data
//   (approved) → messData/global/users  (existing flow)
//
// Load order: AFTER db.js, BEFORE admin.js
// Depends on: config.js, utils.js, db.js, auth.js
// ═══════════════════════════════════════════════


// ═══════════════════════════════════════════════
// PENDING APPROVAL — Firebase helpers
// ═══════════════════════════════════════════════

const pendingRef = firebase.database().ref('pendingApprovals');

// Pending তালিকা লোড করো (realtime নয়, one-time)
function loadPendingApprovals() {
  return pendingRef.once('value').then(snap => {
    const data = snap.val() || {};
    return Object.entries(data).map(([uid, v]) => ({ uid, ...v }));
  });
}

// একটি pending record তৈরি করো (register-এর পরে)
function createPendingRecord(uid, { name, mob, email, job, room, type }) {
  const record = {
    name,
    mobile: mob,
    email,
    jobId: job,
    room: room || '',
    type: type || 'inside',
    registeredAt: new Date().toISOString(),
    status: 'pending'   // 'pending' | 'approved' | 'rejected'
  };
  return pendingRef.child(uid).set(record);
}

// Approve: pending → messData/global/users
function approvePendingUser(uid, pendingData) {
  const uname = 'u_' + pendingData.mobile;
  const newUser = {
    uid,
    u: uname,
    name: pendingData.name,
    mob: pendingData.mobile,
    email: pendingData.email,
    job: pendingData.jobId || '',
    room: pendingData.room || '',
    type: pendingData.type || 'inside',
    role: 'member',
    joined: tod(),
    activeFrom: messMonthKey(),
    emailVerified: true
  };

  // RTDB users/{uid} update করো (role = member, approved = true)
  const userUpdate = {
    name: newUser.name,
    mobile: newUser.mob,
    jobId: newUser.job,
    u: uname,
    room: newUser.room,
    type: newUser.type,
    role: 'member',
    createdAt: pendingData.registeredAt || tod(),
    approved: true
  };

  return Promise.all([
    firebase.database().ref('users/' + uid).update(userUpdate),
    firebase.database().ref('roles/' + uid).set({ role: 'member' }),
    pendingRef.child(uid).update({ status: 'approved', approvedAt: new Date().toISOString(), approvedBy: CU ? CU.u : '' })
  ]).then(() => {
    // Local DB cache-এ যোগ করো
    if (!DB.users) DB.users = [];
    if (!DB.users.find(x => x.u === uname)) {
      DB.users.push(newUser);
      saveUsers();
    }
  });
}

// Reject: status = rejected + reason সংরক্ষণ
function rejectPendingUser(uid, reason) {
  return pendingRef.child(uid).update({
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
    rejectedBy: CU ? CU.u : '',
    rejectReason: reason || ''
  });
}

// Pending count badge আপডেট করো
function updatePendingBadge() {
  if (!isController()) return;
  pendingRef.orderByChild('status').equalTo('pending').once('value').then(snap => {
    const count = snap.numChildren();
    // Admin panel button badge
    const badge = document.getElementById('approval-badge');
    const navBadge = document.getElementById('approval-nav-badge');
    if (badge) {
      badge.textContent = count > 0 ? count : '';
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    if (navBadge) {
      navBadge.textContent = count > 0 ? count : '';
      navBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  });
}


// ═══════════════════════════════════════════════
// PENDING SCREEN — login করলে pending user দেখবে
// ═══════════════════════════════════════════════

function showPendingScreen(uid, status, rejectReason) {
  // pending screen দেখাও — home/admin সব লুকাও
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const sc = document.getElementById('sc-pending-approval');
  if (sc) {
    sc.style.display = 'flex';
    // rejected হলে আলাদা message
    const rejMsg = document.getElementById('pending-reject-msg');
    const waitMsg = document.getElementById('pending-wait-msg');
    if (status === 'rejected') {
      if (waitMsg) waitMsg.style.display = 'none';
      if (rejMsg) {
        rejMsg.style.display = 'block';
        const reasonEl = document.getElementById('pending-reject-reason');
        if (reasonEl) reasonEl.textContent = rejectReason || 'কারণ উল্লেখ করা হয়নি।';
      }
    } else {
      if (rejMsg) rejMsg.style.display = 'none';
      if (waitMsg) waitMsg.style.display = 'block';
    }
  }
}

// Pending user check: login-এর পরে এই function call করো
function checkPendingStatus(uid, onApproved, onPending, onRejected) {
  pendingRef.child(uid).once('value').then(snap => {
    const data = snap.val();
    if (!data) {
      // Pending record নেই → approved member
      onApproved();
      return;
    }
    if (data.status === 'approved') {
      onApproved();
    } else if (data.status === 'rejected') {
      onRejected(data.rejectReason || '');
    } else {
      // pending
      onPending();
    }
  });
}


// ═══════════════════════════════════════════════
// ADMIN PANEL — Member Approval Section
// ═══════════════════════════════════════════════

function renderApprovalList() {
  const container = document.getElementById('approval-list');
  if (!container) return;
  container.innerHTML = '<p class="muted tc" style="padding:16px">লোড হচ্ছে...</p>';

  loadPendingApprovals().then(list => {
    const pending = list.filter(u => u.status === 'pending');
    const processed = list.filter(u => u.status !== 'pending')
      .sort((a, b) => (b.approvedAt || b.rejectedAt || '') > (a.approvedAt || a.rejectedAt || '') ? 1 : -1)
      .slice(0, 10); // সর্বশেষ ১০টি দেখাও

    if (pending.length === 0 && processed.length === 0) {
      container.innerHTML = '<p class="muted tc" style="padding:20px 0">কোনো নিবন্ধন অনুরোধ নেই</p>';
      return;
    }

    let html = '';

    if (pending.length > 0) {
      html += `<div style="font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.5px;margin-bottom:10px;text-transform:uppercase">
        ⏳ অপেক্ষমান (${pending.length})
      </div>`;
      pending.forEach(u => {
        const regDate = u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('bn-BD') : '—';
        html += `
        <div class="approval-card" id="acard-${u.uid}">
          <div class="approval-info">
            <div class="approval-avatar">${(u.name || '?')[0].toUpperCase()}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:14px;color:var(--text)">${esc(u.name || '—')}</div>
              <div style="font-size:11px;color:var(--text-light);margin-top:1px">
                📱 ${esc(u.mobile || '—')} &nbsp;|&nbsp; 🪪 ${esc(u.jobId || '—')}
              </div>
              <div style="font-size:11px;color:var(--text-light)">
                📧 ${esc(u.email || '—')}
              </div>
              <div style="font-size:10px;color:var(--text-light);margin-top:2px">
                নিবন্ধন: ${regDate} &nbsp;|&nbsp; ${u.type === 'outside' ? 'আউটসাইড' : 'ইনসাইড'}
              </div>
            </div>
          </div>
          <div class="approval-actions">
            <button onclick="doApprove('${u.uid}')" class="btn-approve">
              ✅ অনুমোদন
            </button>
            <button onclick="showRejectPanel('${u.uid}')" class="btn-reject">
              ❌ প্রত্যাখ্যান
            </button>
          </div>
          <div class="reject-panel" id="rp-${u.uid}" style="display:none">
            <select id="rsel-${u.uid}" class="form-input" style="font-size:12px;margin-bottom:6px">
              <option value="">— কারণ নির্বাচন করুন —</option>
              <option value="এই মেসের সদস্য নন">এই মেসের সদস্য নন</option>
              <option value="তথ্য যাচাই করা যায়নি">তথ্য যাচাই করা যায়নি</option>
              <option value="ভুল নিবন্ধন">ভুল নিবন্ধন</option>
              <option value="অন্যান্য">অন্যান্য</option>
            </select>
            <input type="text" id="rcustom-${u.uid}" class="form-input" placeholder="বা নিজে লিখুন..." style="font-size:12px;margin-bottom:8px">
            <div style="display:flex;gap:8px">
              <button onclick="doReject('${u.uid}')" class="btn btn-danger btn-sm" style="flex:1;margin:0;padding:8px">নিশ্চিত করুন</button>
              <button onclick="hideRejectPanel('${u.uid}')" class="btn btn-outline btn-sm" style="flex:1;margin:0;padding:8px">বাতিল</button>
            </div>
          </div>
        </div>`;
      });
    }

    if (processed.length > 0) {
      html += `<div style="font-size:12px;font-weight:700;color:var(--text-light);letter-spacing:.5px;margin:18px 0 10px;text-transform:uppercase">
        ✅ সম্প্রতি প্রক্রিয়াকৃত
      </div>`;
      processed.forEach(u => {
        const isApproved = u.status === 'approved';
        const processDate = isApproved
          ? (u.approvedAt ? new Date(u.approvedAt).toLocaleDateString('bn-BD') : '—')
          : (u.rejectedAt ? new Date(u.rejectedAt).toLocaleDateString('bn-BD') : '—');
        html += `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border-radius:10px;margin-bottom:6px;border:1px solid var(--border);">
          <div style="width:34px;height:34px;border-radius:50%;background:${isApproved ? 'linear-gradient(135deg,var(--success),#43a047)' : 'linear-gradient(135deg,#ef5350,#b71c1c)'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">${(u.name || '?')[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text)">${esc(u.name || '—')}</div>
            <div style="font-size:11px;color:var(--text-light)">${esc(u.mobile || '—')} | ${processDate}</div>
            ${!isApproved && u.rejectReason ? `<div style="font-size:10px;color:var(--danger);margin-top:2px">কারণ: ${esc(u.rejectReason)}</div>` : ''}
          </div>
          <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;${isApproved ? 'background:#e8f5e9;color:#2e7d32' : 'background:#ffebee;color:#c62828'}">
            ${isApproved ? '✅ অনুমোদিত' : '❌ প্রত্যাখ্যাত'}
          </span>
        </div>`;
      });
    }

    container.innerHTML = html;
  }).catch(() => {
    container.innerHTML = '<p class="muted tc" style="padding:16px;color:var(--danger)">লোড করতে ব্যর্থ হয়েছে</p>';
  });
}

function showRejectPanel(uid) {
  const panel = document.getElementById('rp-' + uid);
  if (panel) panel.style.display = 'block';
}

function hideRejectPanel(uid) {
  const panel = document.getElementById('rp-' + uid);
  if (panel) panel.style.display = 'none';
}

function doApprove(uid) {
  if (!isController()) { toast('❌ শুধুমাত্র Controller এই কাজ করতে পারবেন।'); return; }
  showModal('অনুমোদন নিশ্চিত করুন', 'এই ব্যবহারকারীকে সদস্য হিসেবে যোগ করবেন?', () => {
    pendingRef.child(uid).once('value').then(snap => {
      const data = snap.val();
      if (!data) { toast('❌ তথ্য পাওয়া যায়নি।'); return; }
      approvePendingUser(uid, data).then(() => {
        toast('✅ সদস্য হিসেবে অনুমোদন দেওয়া হয়েছে!');
        renderApprovalList();
        updatePendingBadge();
      }).catch(err => {
        toast('❌ সমস্যা হয়েছে: ' + (err.message || ''));
      });
    });
  });
}

function doReject(uid) {
  if (!isController()) { toast('❌ শুধুমাত্র Controller এই কাজ করতে পারবেন।'); return; }
  const sel = document.getElementById('rsel-' + uid);
  const custom = document.getElementById('rcustom-' + uid);
  const reason = (custom && custom.value.trim()) || (sel && sel.value) || '';
  if (!reason) { toast('⚠️ প্রত্যাখ্যানের কারণ উল্লেখ করুন।'); return; }

  showModal('প্রত্যাখ্যান নিশ্চিত করুন', `"${esc(reason)}" — এই কারণে প্রত্যাখ্যান করবেন?`, () => {
    rejectPendingUser(uid, reason).then(() => {
      toast('অনুরোধটি প্রত্যাখ্যান করা হয়েছে।');
      renderApprovalList();
      updatePendingBadge();
    }).catch(() => toast('❌ সমস্যা হয়েছে, আবার চেষ্টা করুন।'));
  });
}


// ═══════════════════════════════════════════════
// CSS INJECTION — approval-specific styles
// ═══════════════════════════════════════════════

(function injectApprovalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ── Pending Approval Screen ── */
    #sc-pending-approval {
      position: fixed; inset: 0; z-index: 2000;
      background: var(--bg);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .pending-illustration {
      width: 90px; height: 90px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e3f2fd, #bbdefb);
      display: flex; align-items: center; justify-content: center;
      font-size: 42px;
      margin: 0 auto 20px;
      box-shadow: 0 4px 20px rgba(33,150,243,0.2);
    }
    .pending-title {
      font-size: 20px; font-weight: 800;
      color: var(--text); margin-bottom: 8px;
    }
    .pending-subtitle {
      font-size: 14px; color: var(--text-light);
      line-height: 1.7; margin-bottom: 24px;
      max-width: 320px;
    }
    .pending-info-box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 24px;
      font-size: 13px;
      color: var(--text-light);
      line-height: 1.8;
      max-width: 360px; width: 100%;
    }
    .pending-logout-btn {
      background: transparent;
      border: 1.5px solid var(--border);
      color: var(--text-light);
      border-radius: 12px;
      padding: 11px 28px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all .2s;
    }
    .pending-logout-btn:hover { border-color: var(--danger); color: var(--danger); }

    /* ── Rejection message ── */
    .pending-reject-box {
      background: #ffebee;
      border: 1.5px solid #ef9a9a;
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 24px;
      max-width: 360px; width: 100%;
    }
    .pending-reject-box .rej-title {
      font-size: 15px; font-weight: 700; color: #c62828; margin-bottom: 6px;
    }
    .pending-reject-box .rej-reason {
      font-size: 13px; color: #b71c1c; line-height: 1.6;
    }

    /* ── Approval badge ── */
    .approval-badge-dot {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--danger); color: #fff;
      font-size: 10px; font-weight: 700;
      min-width: 18px; height: 18px;
      border-radius: 9px; padding: 0 4px;
      margin-left: 6px; line-height: 1;
    }

    /* ── Approval cards ── */
    .approval-card {
      background: var(--card);
      border: 1.5px solid var(--border);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 10px;
      transition: border-color .2s;
    }
    .approval-card:hover { border-color: var(--primary); }
    .approval-info {
      display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;
    }
    .approval-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-dark), var(--primary));
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: 16px;
      flex-shrink: 0;
    }
    .approval-actions {
      display: flex; gap: 8px;
    }
    .btn-approve {
      flex: 1; background: linear-gradient(135deg,#2e7d32,#43a047);
      color: #fff; border: none; border-radius: 10px;
      padding: 9px 12px; font-size: 13px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: opacity .2s;
    }
    .btn-approve:hover { opacity: .88; }
    .btn-reject {
      flex: 1; background: transparent;
      color: var(--danger); border: 1.5px solid var(--danger);
      border-radius: 10px; padding: 9px 12px;
      font-size: 13px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: all .2s;
    }
    .btn-reject:hover { background: #ffebee; }
    .reject-panel {
      margin-top: 10px;
      padding: 12px;
      background: var(--bg);
      border-radius: 10px;
      border: 1px solid var(--border);
    }
  `;
  document.head.appendChild(style);
})();
