// Chakra backend adapter for DK's prototype HTML.
//
// DK's HTML keeps tasks in browser storage and calls Anthropic / Google Vision
// directly. This file runs after it and replaces only the functions that touch
// data or keys, so the page itself (layout, text, flows) stays exactly as DK
// wrote it. To ship a new prototype version: copy it in as index.html, empty
// USER_ACCOUNTS, and add <script src="chakra-api.js"></script> before </body>.
//
// Data safety rules:
//   - Tasks load from GET /tasks. The bundled sample tasks are never used.
//   - Saving sends only what changed: POST for new tasks, PATCH for edited ones.
//   - A task is deleted on the server only by "Clear completed", after its
//     confirm. Nothing else can delete; a task missing locally is left alone.
//   - A failed save is retried; the page warns before closing with unsaved work.
(function () {
  'use strict';

  var PROD_API = 'https://chakra-v5-api-service.onrender.com';
  // ?api=http://localhost:8000 points the page at another backend (testing).
  var API = (function () {
    try {
      var q = new URLSearchParams(location.search).get('api');
      if (q) { sessionStorage.setItem('chakra_api', q); return q; }
      return sessionStorage.getItem('chakra_api') || window.CHAKRA_API_URL || PROD_API;
    } catch (e) { return window.CHAKRA_API_URL || PROD_API; }
  })().replace(/\/+$/, '');

  var token = null;

  // V36 has no password on its home page ("Enter" opens Chakra). The backend still needs a
  // sign-in, so the password is asked ONCE per phone; the 30-day sign-in is kept on this
  // phone and Enter just works after that. A sign-in the backend refuses is forgotten.
  var TOKEN_KEY = 'chakra_v24_signin';
  function tokenExp(tk) {
    try {
      var p = tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(p + '===='.slice(p.length % 4 || 4))).exp * 1000;
    } catch (e) { return 0; }
  }
  function loadSavedToken() {
    try {
      var s = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (s && s.token && s.api === API && tokenExp(s.token) > Date.now() + 60000) return s;
    } catch (e) {}
    return null;
  }
  function saveToken(res) {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: res.access_token, user: res.user_id, name: res.display_name, api: API }));
    } catch (e) {}
  }
  function forgetToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  var saved = loadSavedToken();
  if (saved) token = saved.token;

  function request(method, path, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 401 && token) {
        token = null; forgetToken();
        toast('Session expired — please log in again', 'warn', 3500);
        setTimeout(function () { location.reload(); }, 1500);
      }
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var err = new Error((data && data.detail) || ('HTTP ' + r.status));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  // ── Field mapping: backend snake_case ⇄ the HTML's task objects ───────────
  var HORIZON_LABEL = {
    today: 'Today', thisWeek: 'This week', nextWeek: 'Next week', thisMonth: 'Next month',
    thisYear: 'This year', '1year': '1–2 years', '2years': '2+ years',
    parkingLot: 'Parking lot', later: 'Later'
  };
  function labelFor(code, dueDate, entryTs) {
    if (!code) return null;
    if (code === 'Q3' || code === 'Q4') {
      var y = (dueDate || entryTs || '').slice(0, 4) || String(new Date().getFullYear());
      return code + ' ' + y;
    }
    return HORIZON_LABEL[code] || code;
  }

  function fromApi(t) {
    return {
      id: t.id,
      num: t.num,
      title: t.title,
      shortTitle: t.short_title || null,
      bucket: t.bucket,
      category: t.category || null,
      ch: t.ch,
      weightage: t.weightage,
      timeHorizonType: t.time_horizon || null,
      timeHorizon: labelFor(t.time_horizon, t.due_date, t.entry_timestamp),
      dueDate: t.due_date || null,
      dueTime: t.due_time || null,
      durationMin: t.duration_min == null ? null : t.duration_min,
      deadlineSetAt: t.deadline_set_at || null,
      noDateGiven: t.no_date_given === true,
      dueDateAt: t.due_date_at || null,
      needsArea: t.needs_area === true,
      details: t.details || null,
      contacts: t.contacts || [],
      followUpText: t.follow_up_text || null,
      followUpGap: t.follow_up_gap == null ? null : t.follow_up_gap,
      followsId: t.follows_id || null,
      followUpSpawnedId: t.follow_up_spawned_id || null,
      cc: t.cc || null,
      // V36: links, one WhatsApp message, deck snooze / ignore times, background schedule
      links: t.links || [],
      waMsg: t.wa_msg || '',
      snoozeUntil: t.snooze_until == null ? null : t.snooze_until,
      ignoreUntil: t.ignore_until == null ? null : t.ignore_until,
      schedule: t.schedule || null,
      lifeArea: t.life_area,
      multitask: t.multitask,
      linkedTasks: t.linked_tasks || [],
      dependsOn: t.depends_on || null,
      stateHistory: t.state_history || [],
      transitionCount: t.transition_count || 0,
      originBucket: t.origin_bucket,
      completed: !!t.completed,
      completedTimestamp: t.completed_timestamp || null,
      entryTimestamp: t.entry_timestamp,
      agingDays: t.aging_days || 0
    };
  }

  // Everything the server stores for a task, in the server's names. Used both
  // to send and to detect changes, so a field only counts as changed if its
  // stored value would actually differ.
  function toApi(t) {
    return {
      num: t.num == null ? null : t.num,
      title: t.title,
      short_title: t.shortTitle || null,
      bucket: t.bucket,
      category: t.category || null,
      ch: t.ch == null ? null : t.ch,
      weightage: t.weightage || null,
      time_horizon: t.timeHorizonType || null,
      due_date: t.dueDate || null,
      due_time: t.dueTime || null,
      duration_min: t.durationMin == null ? null : t.durationMin,
      deadline_set_at: t.deadlineSetAt || null,
      no_date_given: t.noDateGiven === true,
      due_date_at: t.dueDateAt || null,
      needs_area: t.needsArea === true,
      details: t.details || null,
      contacts: t.contacts || [],
      follow_up_text: t.followUpText || null,
      follow_up_gap: t.followUpGap == null ? null : t.followUpGap,
      follows_id: t.followsId || null,
      follow_up_spawned_id: t.followUpSpawnedId || null,
      cc: t.cc || null,
      links: t.links || [],
      wa_msg: t.waMsg || null,
      snooze_until: t.snoozeUntil == null ? null : t.snoozeUntil,
      ignore_until: t.ignoreUntil == null ? null : t.ignoreUntil,
      schedule: t.schedule || null,
      life_area: t.lifeArea || null,
      multitask: t.multitask === true,
      linked_tasks: t.linkedTasks || [],
      depends_on: t.dependsOn || null,
      state_history: t.stateHistory || [],
      transition_count: t.transitionCount || 0,
      origin_bucket: t.originBucket || t.bucket,
      completed: !!t.completed,
      completed_timestamp: t.completedTimestamp || t.completionDate || null,
      aging_days: t.agingDays || 0
    };
  }

  // ── Sync engine ───────────────────────────────────────────────────────────
  var synced = {};          // id -> JSON of toApi() as last confirmed by the server
  var pendingDeletes = {};  // ids removed by "Clear completed" (or a confirmed follow-up removal), not yet deleted on server
  var chain = Promise.resolve();
  var debounceTimer = null, retryTimer = null;
  var dirty = false;

  function snapshot(tasks) {
    synced = {};
    tasks.forEach(function (t) { synced[t.id] = JSON.stringify(toApi(t)); });
  }

  function syncOnce() {
    var ops = [];
    var seen = {};
    state.tasks.forEach(function (t) {
      if (!t || !t.id) return;
      seen[t.id] = true;
      var now = toApi(t);
      if (!(t.id in synced)) {
        ops.push({ kind: 'create', id: t.id, body: Object.assign({ id: t.id, entry_timestamp: t.entryTimestamp || new Date().toISOString() }, now), json: JSON.stringify(now) });
        return;
      }
      var before = JSON.parse(synced[t.id]);
      var patch = {};
      Object.keys(now).forEach(function (k) {
        if (JSON.stringify(now[k]) !== JSON.stringify(before[k])) patch[k] = now[k];
      });
      if (Object.keys(patch).length) ops.push({ kind: 'patch', id: t.id, body: patch, json: JSON.stringify(now) });
    });
    Object.keys(pendingDeletes).forEach(function (id) {
      if (!seen[id]) ops.push({ kind: 'delete', id: id });
      else delete pendingDeletes[id];
    });
    if (!ops.length) { dirty = false; return Promise.resolve(); }

    syncLbl('⟳ saving…', 'var(--teal2)');
    var failed = 0;
    // One request at a time keeps the order of edits and stays gentle on Render.
    return ops.reduce(function (p, op) {
      return p.then(function () {
        var req = op.kind === 'create' ? request('POST', '/tasks', op.body)
          : op.kind === 'patch' ? request('PATCH', '/tasks/' + encodeURIComponent(op.id), op.body)
          : request('DELETE', '/tasks/' + encodeURIComponent(op.id));
        return req.then(function () {
          if (op.kind === 'delete') { delete synced[op.id]; delete pendingDeletes[op.id]; }
          else synced[op.id] = op.json;
        }, function (err) {
          // Created on the server by an earlier attempt whose reply was lost.
          if (op.kind === 'create' && err.status && err.status >= 500) {
            return request('GET', '/tasks').then(function (list) {
              if (list.some(function (x) { return x.id === op.id; })) {
                synced[op.id] = JSON.stringify(toApi(fromApi(list.filter(function (x) { return x.id === op.id; })[0])));
              } else { failed++; }
            }, function () { failed++; });
          }
          if (op.kind === 'patch' && err.status === 404) {
            // Removed elsewhere (another device / the connector). The next sync recreates it, so DK's edit survives.
            delete synced[op.id];
            failed++;
            return;
          }
          failed++;
        });
      });
    }, Promise.resolve()).then(function () {
      if (failed) {
        dirty = true;
        syncLbl('⚠ not saved — retrying', '#B87800');
        clearTimeout(retryTimer);
        retryTimer = setTimeout(queueSync, 15000);
      } else {
        dirty = false;
        syncLbl('✓ synced · ' + state.tasks.length + ' tasks', 'var(--teal2)');
      }
    });
  }

  function queueSync() {
    dirty = true;
    chain = chain.then(syncOnce, syncOnce);
    return chain;
  }

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('online', function () { if (dirty) queueSync(); });

  // ── Replacements for the HTML's own functions ─────────────────────────────

  // Opens Chakra with the backend sign-in (the page's own "Enter" and its Enter key both land here).
  function openChakra(user, name) {
    var overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.className = 'login-overlay hidden';
    if (window._homeLightsTimer) { clearInterval(window._homeLightsTimer); window._homeLightsTimer = null; }
    if (currentUser) return;                       // already opened once: Enter from Home just hides Home again
    currentUser = { id: user, displayName: name || user };
    DB_KEY = 'chakra_' + currentUser.id + '_tasks_v1';
    loadState();
    try { window.aiPing(); } catch (e) {}
  }

  // The one-time password box, shown over the home page the first time Enter is pressed on a phone.
  function askPassword() {
    var box = document.getElementById('signinBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'signinBox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Sign in to Chakra');
      box.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;';
      box.innerHTML = '<form id="signinForm" style="background:#F5F3EE;color:#1A1A1A;border-radius:18px;padding:20px 18px;width:100%;max-width:340px;font-family:Montserrat,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4);">'
        + '<div style="font-family:\'Cormorant Garamond\',serif;font-size:24px;font-weight:700;color:#1A6B5A;">Sign in once</div>'
        + '<div style="font-size:12.5px;color:#4A463E;margin:4px 0 12px;line-height:1.45;">Enter your Chakra password. This phone will remember it for 30 days, and Enter will just work after that.</div>'
        + '<input id="signinPw" type="password" autocomplete="current-password" placeholder="Password" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #D4CCBC;border-radius:10px;font-size:16px;">'
        + '<div id="signinErr" style="color:#8B1A1A;font-size:12.5px;min-height:18px;margin-top:6px;"></div>'
        + '<div style="display:flex;gap:8px;margin-top:6px;"><button type="button" id="signinCancel" style="flex:1;padding:12px;border-radius:10px;border:1px solid #D4CCBC;background:transparent;font-size:14px;">Cancel</button>'
        + '<button type="submit" style="flex:1;padding:12px;border-radius:10px;border:0;background:#1A6B5A;color:#fff;font-weight:700;font-size:14px;">Enter</button></div></form>';
      document.body.appendChild(box);
      document.getElementById('signinCancel').onclick = function () { box.style.display = 'none'; };
      document.getElementById('signinForm').onsubmit = function (e) {
        e.preventDefault();
        var pw = document.getElementById('signinPw').value || '', err = document.getElementById('signinErr');
        if (!pw) { err.textContent = 'Type your password.'; return; }
        err.textContent = '';
        request('POST', '/auth/login', { user_id: 'dk', password: pw }).then(function (res) {
          token = res.access_token; saveToken(res);
          document.getElementById('signinPw').value = '';
          box.style.display = 'none';
          openChakra(res.user_id, res.display_name);
        }, function (er) {
          err.textContent = (er.status === 401) ? 'That password is not right.' : 'Cannot reach Chakra right now. Try again in a moment.';
        });
      };
    }
    box.style.display = 'flex';
    setTimeout(function () { var i = document.getElementById('signinPw'); if (i) i.focus(); }, 50);
  }

  window.enterChakra = function () {
    if (currentUser && token) { openChakra(currentUser.id, currentUser.displayName); return; }
    var s = loadSavedToken();
    if (s) { token = s.token; openChakra(s.user, s.name); return; }
    var box = document.getElementById('signinBox');
    if (box && box.style.display === 'flex') return;   // the box is open: its own Enter button submits
    askPassword();
  };
  window.attemptLogin = window.enterChakra;

  // V36's AI light on the home page: ask the backend, not the page's /api/ai.
  if (typeof window.aiPing === 'function') {
    window.aiPing = function () {
      try { _aiLastPing = Date.now(); } catch (e) {}
      if (!token || navigator.onLine === false) { aiLight(false); return; }
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; aiLight(false); } }, 12000);
      request('POST', '/llm/parse', { prompt: 'Reply with the single word OK.', max_tokens: 5 }).then(function (res) {
        if (done) return; done = true; clearTimeout(timer);
        if (typeof res.text === 'string') { try { _aiDownUntil = 0; } catch (e) {} aiLight(true); } else aiLight(false);
      }, function () { if (done) return; done = true; clearTimeout(timer); aiLight(false); });
    };
    setTimeout(function () { window.aiPing(); }, 300);   // the page pinged /api/ai at start; ask again the right way
  }

  window.loadState = function () {
    var ldr = document.getElementById('loader'); if (ldr) ldr.style.display = 'flex';
    syncLbl('⟳ loading…', 'var(--teal2)');
    useCloud = true;
    return request('GET', '/tasks').then(function (list) {
      state.tasks = normTasks(list.map(fromApi));
      // Snapshot AFTER the HTML's own clean-up (e.g. empty multitask → No), so
      // that clean-up is shown but never written back to the server by itself.
      snapshot(state.tasks);
      syncLbl('✓ synced · ' + state.tasks.length + ' tasks', 'var(--teal2)');
    }, function () {
      state.tasks = [];
      syncLbl('⚠ could not load — check connection', 'var(--red)');
      toast('Could not load your tasks. Nothing was changed. Reload to try again.', 'warn', 5000);
      // Block saving: with nothing loaded, nothing must be pushed.
      window.saveState = function () { return Promise.resolve(); };
    }).then(function () {
      if (ldr) ldr.style.display = 'none';
      buildTabBar(); updateHeader(); renderTab('today');
      // V24: start the reminders bell and Location AI mode, as the page's own loadState does.
      try { remInit(); } catch (e) {}
    });
  };

  window.saveState = function () {
    clearTimeout(debounceTimer);
    dirty = true;
    return new Promise(function (resolve) {
      debounceTimer = setTimeout(function () { queueSync().then(resolve, resolve); }, 300);
    });
  };

  // The only paths that may delete on the server: "Clear completed", and removing a follow-up when its task is reopened.
  var htmlClearDone = window.clearDone;
  window.clearDone = function () {
    var doneIds = state.tasks.filter(function (t) { return t.completed; }).map(function (t) { return t.id; });
    htmlClearDone();
    var stillThere = {};
    state.tasks.forEach(function (t) { stillThere[t.id] = true; });
    doneIds.forEach(function (id) { if (!stillThere[id]) pendingDeletes[id] = true; });
    if (Object.keys(pendingDeletes).length) window.saveState();
  };

  // V21: reopening a completed task can remove the follow-up it created (after DK confirms).
  // That removal is deleted on the server too, otherwise it would come back after a refresh.
  // The caller (tick box / Task screen) saves right after.
  var htmlOnTaskReopened = window.onTaskReopened;
  if (typeof htmlOnTaskReopened === 'function') {
    window.onTaskReopened = function (t) {
      var before = state.tasks.map(function (x) { return x.id; });
      htmlOnTaskReopened(t);
      var stillThere = {};
      state.tasks.forEach(function (x) { stillThere[x.id] = true; });
      before.forEach(function (id) { if (!stillThere[id]) pendingDeletes[id] = true; });
    };
  }

  // AI calls (task reading, sorting, linking, and reading photos) go through the backend; no key in the page.
  // The page falls back to its keyword reader after 9 s for text, and to "type what you see" after 28 s for a photo,
  // so a slow reply never holds up saving.
  window.apiCall = function (content, onSuccess, onError, image) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      if (onError) onError(new Error('AI timeout'));
    }, image ? 28000 : 9000);
    var body = { prompt: String(content) };
    // V27+ asks for the full text of a photo (2600 tokens); the backend allows up to 4000.
    if (image) { body.image = image; body.max_tokens = 2600; }
    request('POST', '/llm/parse', body).then(function (res) {
      if (done) return;
      done = true; clearTimeout(timer);
      onSuccess((res.text || '').trim());
    }, function (e) {
      if (done) return;
      done = true; clearTimeout(timer);
      if (onError) onError(e);
    });
  };

  // V24: Location AI mode asks which open tasks fit the current place. Same backend AI call;
  // on any failure the page falls back to its own word matching (locLocalMatch).
  if (typeof window.locAiCall === 'function') {
    window.locAiCall = function (content, ok, bad) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        bad();
      }, 45000);
      // V29: the AI answers for every shortlisted task (up to 80). The page asks for 2200 tokens, but a live
      // test cut the answer off after 70 of 80 tasks (broken JSON -> word matching), so allow 4000 and 45 s.
      request('POST', '/llm/parse', { prompt: String(content), max_tokens: 4000 }).then(function (res) {
        if (done) return;
        done = true; clearTimeout(timer);
        if (typeof res.text !== 'string') { bad(); return; }
        ok(res.text);
      }, function () {
        if (done) return;
        done = true; clearTimeout(timer);
        bad();
      });
    };
  }

  // V27: the confirmation box reads everything DK adds with one AI call. Same backend call; the page's 35 s wait
  // is kept, and on failure the page marks AI as down and builds the box from its own word rules.
  if (typeof window.v27Ai === 'function') {
    window.v27Ai = function (content, ok, bad) {
      if (typeof _aiOff === 'function' && _aiOff()) { bad(); return; }
      var done = false;
      var fail = function () {
        if (done) return;
        done = true; clearTimeout(timer);
        if (typeof _aiFailed === 'function') _aiFailed();
        bad();
      };
      var timer = setTimeout(fail, 35000);
      request('POST', '/llm/parse', { prompt: String(content), max_tokens: 2600 }).then(function (res) {
        if (done) return;
        if (typeof res.text !== 'string') { fail(); return; }
        done = true; clearTimeout(timer);
        ok(res.text.trim());
      }, fail);
    };
  }
})();
