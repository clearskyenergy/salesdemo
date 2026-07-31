/* ═══════════════════════════════════════════════════════════════════════════════
   ClearSky-OMEGA · Tenant Branding Layer
   © 2025 ClearSky Energy Solutions LLC. Proprietary and Confidential.

   ─────────────────────────────────────────────────────────────────────────────
   WHY THIS FILE EXISTS
   ─────────────────────────────────────────────────────────────────────────────
   The portal pages (index / marketplace / projects) ship BYTE-IDENTICAL to every
   tenant. No customer name, logo, or domain is baked into their markup. This
   file is the single place that answers "which tenant is this deployment, and
   what does it look like?" — so standing up a new tenant means editing that
   deployment's /config.js and nothing else.

   ─────────────────────────────────────────────────────────────────────────────
   CONFIG CONTRACT  (/config.js, per deployment)
   ─────────────────────────────────────────────────────────────────────────────
   window.CLEARSKY_CONFIG = {
     firebase: { ... },                  // unchanged, as today

     // ── Option A: fully self-describing deployment (RECOMMENDED) ──
     // Works on every page, including ones with no workspace registry.
     tenant: {
       type:         'developer',        // 'developer' | 'partner'
       orgId:        'example.com',      // hard tenant lock — scopes ALL data
       clientName:   'Example Energy',
       accountTier:  'Enterprise',
       tierLevel:    3,
       allowedDomain:'example.com',   // primary sign-in domain
       allowedDomains:['contractor.io'], // OPTIONAL extra domains
       allowedEmails:['jane@gmail.com'], // OPTIONAL individual accounts
       requiredTools:['editor'],
       logo:         '/example-logo.png',
       exportBrand:  { name:'Example Energy', logo:'/example-logo.png' }
     },

     // ── Option B: name a tenant already in the WORKSPACES registry ──
     // tenantKey: 'example.com',

     // ── Option C: omit both → multi-tenant, resolve by email domain ──

     adminDomains: ['csebuilders.com']   // may preview any locked deployment
   };

   Precedence: CFG.tenant → CFG.tenantKey → email-domain lookup in WORKSPACES.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function cfg() { return global.CLEARSKY_CONFIG || {}; }

  function domainOf(email) {
    var parts = String(email || '').split('@');
    return parts[1] ? parts[1].toLowerCase() : '';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Tenant resolution ──────────────────────────────────────────────────── */

  /* The tenant this DEPLOYMENT is pinned to, independent of who signs in.
     Returns null on a true multi-tenant deployment (Option C above).
     `registry` is optional — pages without a WORKSPACES map pass null. */
  function pinned(registry) {
    var c = cfg();
    if (c.tenant && c.tenant.orgId) return c.tenant;
    if (c.tenantKey && registry && registry[c.tenantKey]) return registry[c.tenantKey];
    return null;
  }

  /* Every domain this tenant accepts: `allowedDomain` plus any in the optional
     `allowedDomains` array. */
  function allowedDomainsOf(ws) {
    var out = [];
    if (!ws) return out;
    if (ws.allowedDomain) out.push(String(ws.allowedDomain).toLowerCase());
    var extra = ws.allowedDomains || [];
    for (var i = 0; i < extra.length; i++) out.push(String(extra[i]).toLowerCase());
    return out;
  }

  /* Individually allowlisted addresses. Lets a specific personal account (a
     Gmail, a contractor) into a tenant WITHOUT opening its whole domain. */
  function emailAllowed(ws, email) {
    var list = (ws && ws.allowedEmails) || [];
    var e = String(email || '').toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]).toLowerCase() === e) return true;
    }
    return false;
  }

  /* True once this deployment knows who it is. False means /config.js is
     missing its `tenant` (or `workspaces`) block. */
  function configured(registry) {
    if (pinned(registry)) return true;
    for (var k in registry) { if (registry.hasOwnProperty(k)) return true; }
    return false;
  }

  /* Domains permitted to view a locked deployment in addition to the tenant's
     own (e.g. ClearSky staff previewing a client portal). */
  function adminDomains() {
    var c = cfg();
    return (c.adminDomains && c.adminDomains.length) ? c.adminDomains : [];
  }

  /* The domain users are expected to sign in with. Drives the auth copy.
     NOT a security gate — resolve() is. */
  function defaultDomain(registry) {
    var ws = pinned(registry);
    return (ws && ws.allowedDomain) || cfg().allowedDomain || '';
  }

  /* Domain hint for the Google account chooser. Suppressed when the tenant
     accepts more than one domain or allowlists individual addresses —
     otherwise Google would hide exactly the accounts we just permitted. */
  function googleHint(registry) {
    var ws = pinned(registry);
    if (!ws) return '';
    if ((ws.allowedEmails || []).length) return '';
    if (allowedDomainsOf(ws).length > 1) return '';
    return ws.allowedDomain || '';
  }

  /* Authoritative gate. Returns the workspace this user may use, or null.
       • Locked deployment  → the pinned tenant, if the user's domain matches
                              it or an admin domain; otherwise null.
       • Multi-tenant       → WORKSPACES[user's domain], or null if unknown. */
  function resolve(email, registry) {
    var dom = domainOf(email);
    if (!dom) return null;

    var lock = pinned(registry);
    if (lock) {
      var ok = (allowedDomainsOf(lock).indexOf(dom) >= 0)
            || emailAllowed(lock, email)
            || (adminDomains().indexOf(dom) >= 0);
      return ok ? lock : null;
    }

    if (registry && registry.hasOwnProperty(dom)) return registry[dom];

    /* Multi-tenant hub: honour per-tenant email allowlists too. */
    for (var k in registry) {
      if (registry.hasOwnProperty(k) && emailAllowed(registry[k], email)) return registry[k];
    }
    return null;
  }

  /* ── Brand accessors ────────────────────────────────────────────────────── */

  function nameOf(ws) {
    if (!ws) return '';
    return ws.clientName || (ws.exportBrand && ws.exportBrand.name) || '';
  }

  function logoOf(ws) {
    if (!ws) return '';
    return ws.logo || (ws.exportBrand && ws.exportBrand.logo) || '';
  }

  function tierOf(ws) {
    if (!ws) return '';
    return (ws.type === 'partner')
      ? (ws.partnerKind || 'Partner')
      : ((ws.accountTier || 'Enterprise') + ' Account');
  }

  function platformName() { return cfg().platformName || 'ClearSky-OMEGA'; }

  /* ── DOM painting ───────────────────────────────────────────────────────── */

  function byId(id) { return document.getElementById(id); }

  function setText(id, txt) {
    var el = byId(id);
    if (el && txt) el.textContent = txt;
  }

  function setImg(id, src, alt) {
    var el = byId(id);
    if (!el) return;
    if (src) { el.src = src; el.alt = alt || ''; el.style.display = ''; }
    else { el.style.display = 'none'; }
  }

  /* Paint the app chrome. Safe on any page — absent elements are skipped. */
  function paint(ws) {
    if (!ws) return;
    var name = nameOf(ws), logo = logoOf(ws);

    setText('sn-logo-txt', name);      // sidebar brand
    setText('tb-logo-txt', name);      // topbar brand
    setText('sw-workspace', name);     // workspace drawer heading
    setText('co-scope', name);         // "across every <tenant> project"
    setText('ql-brand', name);         // "<tenant>-branded walkthrough"
    setText('tb-ent-badge', tierOf(ws));

    /* Topbar client chip: logo if configured, else the name as text. */
    var chip = byId('tb-client-logo');
    if (chip) {
      if (logo && chip.tagName === 'IMG') {
        chip.src = logo; chip.alt = name; chip.style.display = '';
      } else if (chip.parentNode) {
        chip.parentNode.innerHTML = '<span class="tb-client-txt">' + esc(name) + '</span>';
      }
    }
  }

  /* Paint the sign-in screen. Runs before auth, so it uses the DEPLOYMENT's
     tenant rather than the user's. */
  function paintAuth(registry) {
    var ws = pinned(registry);
    var name = nameOf(ws);
    var dom = defaultDomain(registry);

    setImg('auth-logo-img', logoOf(ws), name);
    setText('auth-company', name ? name + ' Workspace' : 'Workspace');
    setText('auth-toggle-brand', name ? (name + ' workspace') : 'this workspace');
    setText('auth-note-domain', dom ? '@' + dom : '');
    setText('auth-platform', platformName());

    var note = byId('auth-note-wrap');
    if (note) note.style.display = dom ? '' : 'none';

    var email = byId('auth-email');
    if (email && dom) email.placeholder = 'you@' + dom;
  }

  /* Set <title> as "<tenant> · <page>", falling back to the platform name. */
  function paintTitle(ws, pageLabel) {
    var name = nameOf(ws) || platformName();
    document.title = pageLabel ? (name + ' · ' + pageLabel) : name;
  }

  /* Message shown when a user's domain isn't permitted on this deployment. */
  function accessMessage(email, registry) {
    var who = email || 'an unrecognized account';

    /* Deployment hasn't been configured — say so plainly instead of blaming
       the user's account. This is the message you get if /config.js is stale. */
    if (!configured(registry)) {
      return 'This deployment has no tenant configured. Add a `tenant` block to '
           + '/config.js (see config.example.js), then reload.';
    }

    var dom = defaultDomain(registry);
    return dom
      ? ('This workspace is restricted to @' + dom + ' accounts. You signed in as '
         + who + '. Please sign in with your @' + dom + ' account.')
      : ('This account (' + who + ') is not registered to any workspace on this '
         + 'deployment. Contact your administrator for access.');
  }

  global.OmegaBrand = {
    domainOf:      domainOf,
    esc:           esc,
    pinned:        pinned,
    configured:    configured,
    adminDomains:  adminDomains,
    defaultDomain: defaultDomain,
    googleHint:    googleHint,
    allowedDomainsOf: allowedDomainsOf,
    emailAllowed:  emailAllowed,
    resolve:       resolve,
    nameOf:        nameOf,
    logoOf:        logoOf,
    tierOf:        tierOf,
    platformName:  platformName,
    paint:         paint,
    paintAuth:     paintAuth,
    paintTitle:    paintTitle,
    accessMessage: accessMessage
  };
})(window);
