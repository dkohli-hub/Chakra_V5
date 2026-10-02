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

  function request(method, path, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 401 && token) {
        token = null;
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
  var pendingDeletes = {};  // ids "Clear completed" removed, not yet deleted on server
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

  window.attemptLogin = function () {
    var idVal = (document.getElementById('loginId').value || '').trim().toLowerCase();
    var pwVal = document.getElementById('loginPw').value || '';
    var err = document.getElementById('loginError');
    if (!idVal || !pwVal) { if (err) err.textContent = 'Incorrect ID or password.'; return; }
    if (err) err.textContent = '';
    request('POST', '/auth/login', { user_id: idVal, password: pwVal }).then(function (res) {
      token = res.access_token;
      currentUser = { id: res.user_id, displayName: res.display_name };
      DB_KEY = 'chakra_' + currentUser.id + '_tasks_v1';
      var overlay = document.getElementById('loginOverlay');
      if (overlay) overlay.className = 'login-overlay hidden';
      renderUserBadge();
      loadState();
    }, function (e) {
      if (err) err.textContent = (e.status === 401) ? 'Incorrect ID or password.'
        : 'Cannot reach Chakra right now. Try again in a moment.';
    });
  };

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
    });
  };

  window.saveState = function () {
    clearTimeout(debounceTimer);
    dirty = true;
    return new Promise(function (resolve) {
      debounceTimer = setTimeout(function () { queueSync().then(resolve, resolve); }, 300);
    });
  };

  // The only path that may delete on the server.
  var htmlClearDone = window.clearDone;
  window.clearDone = function () {
    var doneIds = state.tasks.filter(function (t) { return t.completed; }).map(function (t) { return t.id; });
    htmlClearDone();
    var stillThere = {};
    state.tasks.forEach(function (t) { stillThere[t.id] = true; });
    doneIds.forEach(function (id) { if (!stillThere[id]) pendingDeletes[id] = true; });
    if (Object.keys(pendingDeletes).length) window.saveState();
  };

  // AI classification and auto-linking go through the backend; no key in the page.
  window.apiCall = function (content, onSuccess, onError) {
    request('POST', '/llm/parse', { prompt: String(content) }).then(function (res) {
      onSuccess((res.text || '').trim());
    }, function (e) { if (onError) onError(e); });
  };

  // Photo → text through the backend; the Vision key stays on the server.
  window.imgData = window.imgData || null;
  window.handleImg = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var prev = document.getElementById('imgPrev');
    var scan = document.getElementById('imgScan');
    var clr = document.getElementById('imgClear');
    if (scan) { scan.className = 'img-scanning show'; scan.textContent = 'Reading your handwriting…'; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var image = new Image();
      image.onload = function () {
        var mW = 1200, scale = image.width > mW ? mW / image.width : 1;
        var cv = document.createElement('canvas');
        cv.width = Math.round(image.width * scale); cv.height = Math.round(image.height * scale);
        cv.getContext('2d').drawImage(image, 0, 0, cv.width, cv.height);
        var compressed = cv.toDataURL('image/jpeg', 0.85);
        if (prev) { prev.src = compressed; prev.className = 'img-preview show'; }
        if (clr) clr.className = 'img-clear show';
        request('POST', '/ocr/scan', { image_base64: compressed.split(',')[1] }).then(function (res) {
          if (scan) scan.className = 'img-scanning';
          var text = (res.text || '').trim();
          if (text) showOcrResult(text);
          else toast('No text found in image — try a clearer photo.', 'warn', 3500);
        }, function () {
          if (scan) scan.className = 'img-scanning';
          toast('Could not read the photo right now — type the tasks instead.', 'warn', 3500);
        });
      };
      image.onerror = function () { if (scan) scan.className = 'img-scanning'; };
      image.src = e.target.result;
    };
    reader.onerror = function () { if (scan) scan.className = 'img-scanning'; };
    reader.readAsDataURL(file);
  };
})();
