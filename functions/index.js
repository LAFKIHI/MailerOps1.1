'use strict';

const { onRequest }    = require('firebase-functions/v2/https');
const { onSchedule }   = require('firebase-functions/v2/scheduler');
const { initializeApp }= require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { OAuth2Client } = require('google-auth-library');
const axios            = require('axios');

initializeApp();
const db = getFirestore();

const POSTMASTER_BASE = 'https://gmailpostmastertools.googleapis.com/v1';
const REDIRECT_URI    = 'https://us-central1-mailer-ops.cloudfunctions.net/postmasterCallback';

async function loadCredentials(uid) {
  const snap = await db.collection('postmasterCredentials').doc(uid).get();
  if (!snap.exists) throw new Error('No credentials found. Upload client_secret.json first.');
  return snap.data();
}

async function loadTokens(uid) {
  const snap = await db.collection('postmasterTokens').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function saveTokens(uid, tokens) {
  await db.collection('postmasterTokens').doc(uid).set(
    { ...tokens, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

function normRep(val) {
  if (!val || val === 'REPUTATION_CATEGORY_UNSPECIFIED') return '—';
  return val;
}

// ── FUNCTION 1: postmasterAuth ────────────────────────────────────
exports.postmasterAuth = onRequest({ cors: true }, async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).send('Missing uid');
  try {
    const creds = await loadCredentials(uid);
    const oauth = new OAuth2Client(creds.clientId, creds.clientSecret, REDIRECT_URI);
    const url   = oauth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/postmaster.readonly'],
      prompt: 'consent',
      state: uid,
    });
    res.redirect(url);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ── FUNCTION 2: postmasterCallback ───────────────────────────────
exports.postmasterCallback = onRequest({ cors: true }, async (req, res) => {
  const code = req.query.code;
  const uid  = req.query.state;
  if (!code || !uid) return res.status(400).send('Missing code or state');
  try {
    const creds = await loadCredentials(uid);
    const oauth = new OAuth2Client(creds.clientId, creds.clientSecret, REDIRECT_URI);
    const { tokens } = await oauth.getToken(code);
    await saveTokens(uid, tokens);
    oauth.setCredentials(tokens);
    await fetchAndSaveAllDomains(uid, oauth);
    res.redirect('https://mailer-ops.web.app/servers?postmaster=connected');
  } catch (err) {
    console.error('Callback error:', err.message);
    res.redirect('https://mailer-ops.web.app/servers?postmaster=error');
  }
});

// ── FUNCTION 3: postmasterFetch ───────────────────────────────────
exports.postmasterFetch = onRequest({ cors: true }, async (req, res) => {
  const uid   = req.query.uid;
  const check = req.query.check === 'true';
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  try {
    const tokenData = await loadTokens(uid);
    if (!tokenData) return res.status(401).json({ error: 'Not authenticated. Connect first.' });
    if (check) {
      return res.json({
        connected:        true,
        lastFetchAt:      tokenData.lastFetchAt      ?? null,
        lastFetchDomains: tokenData.lastFetchDomains ?? 0,
      });
    }
    const creds = await loadCredentials(uid);
    const oauth = new OAuth2Client(creds.clientId, creds.clientSecret, REDIRECT_URI);
    oauth.setCredentials(tokenData);
    oauth.on('tokens', async (newTokens) => {
      await saveTokens(uid, { ...tokenData, ...newTokens });
    });
    const count = await fetchAndSaveAllDomains(uid, oauth);
    res.json({ success: true, domainsUpdated: count, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── FUNCTION 4: scheduled daily ──────────────────────────────────
exports.postmasterScheduled = onSchedule(
  { schedule: 'every day 06:00', timeZone: 'UTC' },
  async () => {
    const snapshot = await db.collection('postmasterTokens').get();
    let total = 0;
    for (const docSnap of snapshot.docs) {
      const uid       = docSnap.id;
      const tokenData = docSnap.data();
      try {
        const creds = await loadCredentials(uid);
        const oauth = new OAuth2Client(creds.clientId, creds.clientSecret, REDIRECT_URI);
        oauth.setCredentials(tokenData);
        oauth.on('tokens', async (t) => await saveTokens(uid, { ...tokenData, ...t }));
        const count = await fetchAndSaveAllDomains(uid, oauth);
        total += count;
        console.log(`[${uid}] ${count} records updated`);
      } catch (err) {
        console.error(`[${uid}] Error:`, err.message);
      }
    }
    console.log(`Scheduled fetch done. Total: ${total}`);
  }
);

// ── Core: fetch all domains — FIXED date handling ─────────────────
async function fetchAndSaveAllDomains(uid, oauth) {
  const token   = (await oauth.getAccessToken()).token;
  const headers = { Authorization: `Bearer ${token}` };

  const domainsRes = await axios.get(`${POSTMASTER_BASE}/domains`, { headers });
  const pmDomains  = domainsRes.data.domains ?? [];
  if (!pmDomains.length) {
    console.log(`[${uid}] No domains registered in Postmaster Tools`);
    return 0;
  }

  // Fetch last 30 days — Postmaster data is typically 2-3 days delayed
  // We fetch wide to ensure we capture any available data
  const today = new Date();
  const dates  = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0,10).replace(/-/g,''));
  }

  let updated = 0;

  // Track the most recent data found per domain to update the live domain doc
  // Key: domainName → { isoDate, domainRep, ipRep, spamRate }
  const latestPerDomain = {};

  for (const pm of pmDomains) {
    const domainName = pm.name.replace('domains/', '');

    for (const dateKey of dates) {
      const isoDate = `${dateKey.slice(0,4)}-${dateKey.slice(4,6)}-${dateKey.slice(6,8)}`;
      try {
        const statsRes = await axios.get(
          `${POSTMASTER_BASE}/domains/${domainName}/trafficStats/${dateKey}`,
          { headers }
        );
        const s = statsRes.data;

        // Only save if there's meaningful data (skip empty records)
        const domRep = normRep(s.domainReputation);
        const ipRep  = normRep(s.ipReputation?.[0]?.reputation ?? s.ipReputation);
        const spam   = s.spamRatePercent != null
          ? ((s.spamRatePercent * 100).toFixed(4) + '%')
          : '0%';

        const repData = {
          userId:    uid,
          domainName,
          date:      isoDate,
          domainRep: domRep,
          ipRep:     ipRep,
          spamRate:  spam,
          // Store raw values too for future use
          spamRateRaw:           s.spamRatePercent ?? 0,
          userReportedSpamRatio: s.userReportedSpamRatio ?? 0,
          spamFilteredRatio:     s.spamFilteredRatio     ?? 0,
          source:    'postmaster_api',
          fetchedAt: new Date().toISOString(),
        };

        // Save to postmasterStats collection (full history)
        await db.collection('postmasterStats')
          .doc(`${uid}_${domainName}_${isoDate}`)
          .set(repData, { merge: true });

        // ── FIX: track most recent date with real data per domain ──
        // We keep the most recent date regardless of whether it's "today"
        // because Postmaster data is delayed (e.g. Feb 24 data fetched on Mar 20)
        const existing = latestPerDomain[domainName];
        if (!existing || isoDate > existing.date) {
          // Only update if we have meaningful reputation data
          if (domRep !== '—' || ipRep !== '—' || parseFloat(spam) > 0) {
            latestPerDomain[domainName] = { isoDate, domainRep: domRep, ipRep, spamRate: spam };
          } else if (!existing) {
            // Even if no rep data, track it so we at least record the date
            latestPerDomain[domainName] = { isoDate, domainRep: domRep, ipRep, spamRate: spam };
          }
        }

        updated++;
      } catch (err) {
        // 404 = no data for that date (normal for recent dates), skip silently
        if (err.response?.status !== 404) {
          console.warn(`[${domainName}/${dateKey}]`, err.message);
        }
      }
    }
  }

  // ── FIX: Update live domain docs with the MOST RECENT data found ──
  // This runs AFTER all dates are fetched so we use the freshest data available
  for (const [domainName, latest] of Object.entries(latestPerDomain)) {
    try {
      const q = await db.collection('domains')
        .where('userId', '==', uid)
        .where('domain', '==', domainName)
        .limit(1).get();

      if (!q.empty) {
        const domRef = q.docs[0].ref;
        const domId  = q.docs[0].id;

        // Update the domain document with the most recent data found
        await domRef.update({
          domainRep: latest.domainRep,
          spamRate:  latest.spamRate,
          // Show the actual data date, not today's date
          lastCheck: `${latest.isoDate} (API)`,
        });

        // Add to reputation history — check it doesn't already exist
        const existingRep = await db.collection('reputation')
          .where('userId',   '==', uid)
          .where('domainId', '==', domId)
          .where('date',     '==', latest.isoDate)
          .where('source',   '==', 'postmaster_api')
          .limit(1).get();

        if (existingRep.empty) {
          await db.collection('reputation').add({
            userId:    uid,
            domainId:  domId,
            date:      latest.isoDate,
            domainRep: latest.domainRep,
            ipRep:     latest.ipRep,
            spamRate:  latest.spamRate,
            source:    'postmaster_api',
          });
        }

        console.log(`[${domainName}] Updated with data from ${latest.isoDate}`);
      }
    } catch (err) {
      console.warn(`[${domainName}] Failed to update domain doc:`, err.message);
    }
  }

  await db.collection('postmasterTokens').doc(uid).update({
    lastFetchAt:      new Date().toISOString(),
    lastFetchDomains: pmDomains.length,
  });

  return updated;
}
