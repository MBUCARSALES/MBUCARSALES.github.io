// ============================================================================
// MBU CAR SALES — SEND EMAIL  (invoices straight from the admin app)
// ----------------------------------------------------------------------------
// Sends one email from the dealership's own Gmail, mbusales39@gmail.com, with
// the invoice PDF attached, the subject exactly as the app wrote it, and the
// message as typed. Gmail keeps a copy in Sent, as if it had been sent from
// the Gmail app, and replies come back to the same inbox.
//
// Why a function: a phone's share sheet can't fill in the To box, and Gmail
// on an iPhone ignores the subject it's handed (7 Oct 2026). Sending from
// here does both properly. The share sheet stays in the app as the fallback.
//
// Only signed-in admins can use it: it asks the database "is the caller an
// admin?" with the caller's own token, the same check as autotrader.
//
//   { action: 'status' }  → { configured, from }   is it set up?
//   { action: 'test' }    → sends a short test email to the Gmail address itself
//   { action: 'send', to, subject, text, filename, pdf }   pdf = base64
//
// ----------------------------------------------------------------------------
// SET UP (no command line needed). Full steps: SWITCH-ON-GUIDE.md, step 5.
//   1. Google: the mbusales39 account needs 2-Step Verification on. Then
//      myaccount.google.com/apppasswords → name it "MBU admin app" → Create.
//      Copy the 16 letters it shows (they're only shown once).
//   2. Supabase → Edge Functions → Secrets → add:
//        GMAIL_USER          mbusales39@gmail.com
//        GMAIL_APP_PASSWORD  the 16 letters (spaces don't matter)
//        FROM_NAME           MBU Car Sales            (optional)
//   3. Edge Functions → Deploy a new function → name it exactly  send-email
//      → paste this file → Deploy. Then turn OFF "Verify JWT" for it: it
//      checks the caller itself (as above), and the switch can refuse the
//      app's sign-in tokens.
//   4. Admin app → gear → Setup → Send a test email.
//
//   ⚠️ The app password can send email as the business. It lives only in
//      Supabase's secrets: never in config.js, never in the app, never in Git.
//      If it ever leaks, delete it at myaccount.google.com/apppasswords.
//
// Gmail allows about 500 emails a day from an ordinary account; this also
// stops at 40 in any 10 minutes, so a fault in the app can't run away.
// ============================================================================

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const env = (k: string) => (typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined) ?? '';
const config = () => ({
  user: env('GMAIL_USER').trim(),
  pass: env('GMAIL_APP_PASSWORD').replace(/\s+/g, ''),
  name: (env('FROM_NAME') || 'MBU Car Sales').replace(/["<>\r\n]/g, '').trim()
});

export type Mail = { from: string; to: string; replyTo: string; subject: string; text: string;
  attachments: { filename: string; content: string; encoding: 'base64'; contentType: string }[] };
export type Deps = { isAdmin: (req: Request) => Promise<boolean>; send: (mail: Mail) => Promise<string> };

/* --------------------------------------------------- who may call this */
async function callerIsAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) { console.error('SUPABASE_URL / anon key missing'); return false; }
  try {
    const res = await fetch(`${url}/rest/v1/rpc/is_admin`, {
      method: 'POST', headers: { apikey: key, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}'
    });
    return res.ok && (await res.json()) === true;
  } catch (err) {
    console.error('Admin check failed:', err);
    return false;
  }
}

/* ------------------------------------------------------- Gmail, on 465
   Supabase blocks outgoing ports 25 and 587, so it's Gmail's SSL port. */
async function gmailSend(mail: Mail): Promise<string> {
  const c = config();
  // Loaded only when sending, so the tests never need it
  const nodemailer = (await import('npm:nodemailer@6.9.16')).default;
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: c.user, pass: c.pass } });
  const info = await t.sendMail(mail);
  return String(info.messageId || '');
}

/* ------------------------------------------------------------- checks */
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\r\n?/g, '\n').slice(0, max);
const oneLine = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const MAX_PDF = 10 * 1024 * 1024;   // decoded; an invoice is usually under 1MB

// A runaway loop in the app stops here, not 500 emails later
const recent: number[] = [];
function tooMany(now = Date.now()) {
  while (recent.length && now - recent[0] > 10 * 60 * 1000) recent.shift();
  if (recent.length >= 40) return true;
  recent.push(now);
  return false;
}

function gmailError(err: any) {
  const m = String((err && (err.response || err.message)) || err);
  if ((err && err.code === 'EAUTH') || /\b535\b|Username and Password not accepted|Application-specific password required/i.test(m))
    return 'Gmail didn’t accept the app password. Make a new one at myaccount.google.com/apppasswords and put it in GMAIL_APP_PASSWORD.';
  if (/ECONNECTION|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|timeout/i.test(m)) return 'Couldn’t reach Gmail just now. Try again in a minute.';
  if (/\b550\b|\b553\b|recipient|mailbox/i.test(m)) return 'Gmail wouldn’t send to that address. Check it’s typed right.';
  if (/\b4\d\d\b|limit|quota/i.test(m)) return 'Gmail has paused sending for a while (too many today). Use Share instead for now.';
  return 'Gmail couldn’t send it: ' + m.slice(0, 160);
}

export async function handle(req: Request, deps: Deps = { isAdmin: callerIsAdmin, send: gmailSend }): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!(await deps.isAdmin(req))) return json({ error: 'You need to be signed in to the admin app to send email.' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'Could not read that request.' }, 400); }
  const c = config();
  const configured = EMAIL.test(c.user) && c.pass.length >= 16;
  const action = String(body.action ?? 'send');

  if (action === 'status') return json({ configured, from: configured ? c.user : null,
    missing: [!EMAIL.test(c.user) && 'GMAIL_USER', c.pass.length < 16 && 'GMAIL_APP_PASSWORD'].filter(Boolean) });
  if (!configured) return json({ error: 'Sending isn’t set up yet: add GMAIL_USER and GMAIL_APP_PASSWORD in Supabase → Edge Functions → Secrets.', code: 'not_configured' }, 503);
  if (tooMany()) return json({ error: 'That’s a lot of emails in ten minutes. Wait a few minutes and try again.' }, 429);

  const from = `"${c.name}" <${c.user}>`;
  let mail: Mail;
  if (action === 'test') {
    mail = { from, to: c.user, replyTo: c.user, subject: 'Test from the MBU admin app',
      text: 'This is a test from the MBU admin app. If you can read it, invoices can be sent straight from the app, and they’ll be in Sent like this one.', attachments: [] };
  } else if (action === 'send') {
    const to = oneLine(body.to, 254).toLowerCase();
    if (!EMAIL.test(to)) return json({ error: 'That email address doesn’t look right.' }, 400);
    const subject = oneLine(body.subject, 300);
    const text = clean(body.text, 20000);
    if (!subject || !text.trim()) return json({ error: 'The subject or the message is empty.' }, 400);
    const attachments: Mail['attachments'] = [];
    if (body.pdf) {
      const b64 = String(body.pdf).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
      if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return json({ error: 'The PDF didn’t come through. Try again.' }, 400);
      if (b64.length * 3 / 4 > MAX_PDF) return json({ error: 'The PDF is too big to email (over 10MB).' }, 413);
      const filename = (oneLine(body.filename, 120).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '') || 'MBU-invoice').replace(/(\.pdf)?$/i, '.pdf');
      attachments.push({ filename, content: b64, encoding: 'base64', contentType: 'application/pdf' });
    }
    mail = { from, to, replyTo: c.user, subject, text, attachments };
  } else {
    return json({ error: 'Unknown action.' }, 400);
  }

  try {
    const id = await deps.send(mail);
    return json({ ok: true, to: mail.to, from: c.user, id });
  } catch (err) {
    console.error('send-email', err);
    return json({ error: gmailError(err) }, 502);
  }
}

// Only start the server when running inside Supabase; the tests import handle()
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !(globalThis as any).__SEND_TEST__) {
  Deno.serve(req => handle(req));
}
