/* ============================================================================
   MBU ADMIN: invoices — what goes on one, worked out from the figures
   ----------------------------------------------------------------------------
   Pure functions, no page and no database, so it runs in the browser or in
   Node (_private/tests/test-invoice.js). app.js holds the screens.

     KINDS            the kinds of invoice, and the defaults each one sets
     TERMS            every standard term, its wording worked out from the
                      invoice's own figures, and which kinds use it
     totals(inv)      price, extras, part exchange, paid, balance
     makeSchedule()   an instalment plan from a count or an amount
     warnings(inv)    anything that needs a second look before it goes out,
                      including an instalment plan outside the FCA exemption
     buildDoc(inv, s) the finished invoice as blocks: title, details, money,
                      schedule, terms, notes, signatures, footer
     toHtml(doc)      those blocks as the on-screen preview
     toPdf(doc, ...)  the same blocks drawn with jsPDF, to attach or print

   Every kind is only a starting point: each term can be switched off or
   reworded, terms from other kinds added, and your own written in. The
   point is that no invoice ever has to be written from scratch again.

   An invoice (`inv`) looks like:
     { kind, title, subtitle, issue_date, sale_date, number,
       vehicle:  { registration, make, model, variant, year, mileage, colour, vin },
       customer: { name, phone, email, address },
       seller:   { name, phone },                    the MBU person on the deal
       price, extras: [{ label, amount }],           amount < 0 is a discount
       px: { on, registration, make, model, allowance },
       payments: [{ date, amount, method, deposit }],
       deposit_nonrefundable, balance_due_date, balance_on_collection,
       plan: { count, amount, first, frequency, rows: [{ due, amount, paid_on }], edited },
       terms: { [key]: { off } | { head, text } },   changes to standard terms
       extra_terms: [key], custom_terms: [{ head, text }],
       notes, options: { company, vat },
       signatures: { buyer: { png, name, date }, seller: { png, name, date } } }
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MBU_INVOICE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------- FORMATTING */
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const gbp = n => (r2(n) < 0 ? '−£' : '£') + Math.abs(r2(n)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sum = (xs, f) => r2(xs.reduce((a, x) => a + (Number(f ? f(x) : x) || 0), 0));
  const has = v => v != null && String(v).trim() !== '';

  // Dates are kept as 'YYYY-MM-DD' and read as local dates, so a date never
  // slips a day either side of midnight or the clocks changing
  function parseDate(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function isoDate(d) {
    if (!d) return '';
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function ukDate(s) {
    const d = parseDate(s); if (!d) return '';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function longDate(s) {
    const d = parseDate(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
  }
  function ordinal(n) {
    const s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  // Same day next month, or the last day of a shorter month (31 Jan → 28 Feb)
  function addMonths(d, k, day) {
    const want = day || d.getDate();
    const t = new Date(d.getFullYear(), d.getMonth() + k, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(want, last));
    return t;
  }
  const addDays = (d, k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
  const today = () => isoDate(new Date());

  const plate = r => {
    const s = String(r || '').toUpperCase().replace(/\s+/g, '');
    return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(s) ? s.slice(0, 4) + ' ' + s.slice(4) : s;
  };
  const vehicleName = v => [v && v.make, v && v.model].filter(has).join(' ');
  const numberLabel = n => n ? 'MBU-' + n : '';

  /* ---------------------------------------------------------------- KINDS
     `terms` is the standard set, in the order they print. A term whose
     `when` doesn't hold (no deposit, no part exchange) is left out without
     anyone having to untick it. */
  const KINDS = {
    paid: {
      label: 'Paid in full', short: 'Paid in full',
      title: 'Vehicle Sale Invoice', subtitle: 'Vehicle purchase and full payment confirmation',
      help: 'The car’s sold and paid for. A deposit taken earlier goes in as a payment.',
      termsTitle: 'Sale & Payment Terms',
      terms: ['full_payment', 'deposit_part', 'deposit_terms', 'px', 'extras', 'payment_record', 'vat_margin', 'statutory']
    },
    deposit: {
      label: 'Deposit taken', short: 'Deposit',
      title: 'Deposit Receipt', subtitle: 'Vehicle reserved on payment of a deposit',
      help: 'The car’s reserved with a deposit and the rest comes later.',
      termsTitle: 'Deposit Terms',
      terms: ['deposit_received', 'balance_due', 'reservation', 'deposit_terms', 'px', 'vat_margin', 'statutory']
    },
    balance: {
      label: 'Balance to pay', short: 'Balance due',
      title: 'Vehicle Sale Invoice', subtitle: 'Sale invoice with the balance to pay',
      help: 'Sold, part paid, the rest due on collection or by a date. The car goes when it’s paid.',
      termsTitle: 'Sale & Payment Terms',
      terms: ['outstanding', 'balance_due', 'release', 'deposit_part', 'deposit_terms', 'px', 'extras', 'vat_margin', 'statutory']
    },
    instalments: {
      label: 'Pay monthly', short: 'Instalments',
      title: 'Vehicle Sale & Instalment Payment Agreement', subtitle: 'Sale invoice and outstanding balance payment schedule',
      help: 'They drive away and pay the rest in instalments, interest free.',
      termsTitle: 'Payment & Default Terms',
      terms: ['plan_outstanding', 'plan_payments', 'payment_record', 'plan_failure', 'plan_changes', 'plan_early', 'plan_no_charges', 'plan_settlement', 'px', 'vat_margin', 'statutory']
    },
    trade: {
      label: 'Trade sale', short: 'Trade',
      title: 'Trade Sale Invoice', subtitle: 'Vehicle sold to the motor trade',
      help: 'Sold to another dealer or trader, as seen.',
      termsTitle: 'Terms of Sale',
      terms: ['trade_buyer', 'sold_as_seen', 'trade_payment', 'px', 'vat_margin', 'lawful']
    },
    purchase: {
      label: 'We bought a car', short: 'Purchase',
      title: 'Vehicle Purchase Receipt', subtitle: 'Vehicle bought by MBU Sales Limited',
      help: 'Someone sold their car to you. They’re the seller on this one.',
      termsTitle: 'Terms of Purchase',
      terms: ['buy_owner', 'buy_finance', 'buy_description', 'buy_payment', 'buy_documents']
    },
    general: {
      label: 'Anything else', short: 'Invoice',
      title: 'Invoice', subtitle: '',
      help: 'Any other invoice: delivery, an MOT, repairs, a part. Add each line.',
      termsTitle: 'Terms',
      terms: ['general_payment', 'vat_margin', 'statutory']
    }
  };
  const KIND_ORDER = ['paid', 'deposit', 'balance', 'instalments', 'trade', 'purchase', 'general'];
  const kindOf = inv => KINDS[inv && inv.kind] || KINDS.paid;

  /* --------------------------------------------------------------- TOTALS */
  function totals(inv) {
    const extras = (inv.extras || []).filter(x => has(x.label) || Number(x.amount));
    const price = r2(inv.price);
    const goods = r2(price + sum(extras, x => x.amount));
    const px = inv.px && inv.px.on ? r2(inv.px.allowance) : 0;
    const due = r2(goods - px);
    const payments = (inv.payments || []).filter(p => Number(p.amount));
    const paid = sum(payments, p => p.amount);
    const deposit = sum(payments.filter(p => p.deposit), p => p.amount);
    const balance = r2(due - paid);
    return { price, extras, goods, px, due, payments, paid, deposit, balance };
  }

  /* ------------------------------------------------------------- SCHEDULE
     Either a number of payments (each the balance ÷ count, the pennies on
     the last) or an amount each (as many as it takes, the last one smaller).
     Monthly payments land on the same day each month, or the last day of a
     shorter month. */
  function makeSchedule({ balance, count, amount, first, frequency }) {
    balance = r2(balance);
    const start = parseDate(first);
    if (!(balance > 0) || !start) return [];
    let n = Math.floor(Number(count) || 0), each = r2(amount);
    if (each > 0 && !(n > 0)) n = Math.ceil(balance / each - 1e-9);
    if (!(n > 0)) return [];
    n = Math.min(n, 120);
    if (!(each > 0)) each = Math.floor(balance / n * 100) / 100;
    const rows = [];
    let left = balance;
    for (let i = 0; i < n && left > 0.004; i++) {
      const due = frequency === 'weekly' ? addDays(start, 7 * i)
        : frequency === 'fortnightly' ? addDays(start, 14 * i)
        : addMonths(start, i, start.getDate());
      const amt = i === n - 1 ? left : Math.min(each, left);
      rows.push({ due: isoDate(due), amount: r2(amt) });
      left = r2(left - amt);
    }
    return rows;
  }

  /* What the plan was set up to cover: the balance left after the price,
     extras, part exchange and anything paid up front. Instalments paid
     since (payments marked `instalment`) don't change it: they tick rows
     off instead, oldest first, each dated by the payment that cleared it. */
  function planBase(inv) {
    const later = sum((inv.payments || []).filter(p => p.instalment), p => p.amount);
    return r2(totals(inv).balance + later);
  }

  function planRows(inv) {
    const p = inv.plan || {};
    const rows = (p.edited && Array.isArray(p.rows) ? p.rows
      : makeSchedule({ balance: planBase(inv), count: p.count, amount: p.amount, first: p.first, frequency: p.frequency }))
      .map(r => ({ due: r.due, amount: r2(r.amount) }));
    const pays = (inv.payments || []).filter(x => x.instalment && Number(x.amount))
      .slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    let credit = 0, i = 0, when = null;
    for (const r of rows) {
      while (credit < r.amount - 0.004 && i < pays.length) { credit = r2(credit + Number(pays[i].amount)); when = pays[i].date || null; i++; }
      if (credit < r.amount - 0.004) break;
      r.paid_on = when || today();
      credit = r2(credit - r.amount);
    }
    return rows;
  }

  // "£500.00 on the 5th of each month", or null when the amounts differ
  function planShape(rows, frequency) {
    if (!rows.length) return null;
    const amts = rows.map(r => r2(r.amount));
    const same = amts.slice(0, -1).every(a => a === amts[0]);
    const lastDiff = amts[amts.length - 1] !== amts[0];
    const firstD = parseDate(rows[0].due);
    const when = frequency === 'weekly' ? 'every week'
      : frequency === 'fortnightly' ? 'every two weeks'
      : `on the ${ordinal(firstD.getDate())} of each month`;
    return { each: amts[0], allSame: same && !lastDiff, lastDiff: same && lastDiff, last: amts[amts.length - 1], when, count: rows.length };
  }
  const FREQ_WORD = { monthly: 'monthly', weekly: 'weekly', fortnightly: 'fortnightly' };

  /* ---------------------------------------------------------------- TERMS
     Wording based on the invoices MBU already sends, tightened. Each term:
       label   what it's called in the app's list
       kinds   which kinds include it as standard (others can add it)
       when    leave it out unless this holds
       make    { head, text } from the invoice's own figures */
  const TERMS = {
    full_payment: { label: 'Paid in full', make: (inv, t) => ({ head: 'Full payment received.',
      text: `MBU Sales Limited confirms that the total agreed price of ${gbp(t.due)} has been paid in full by the buyer. There is no outstanding balance.` }) },

    deposit_part: { label: 'Deposit was part of the price', when: (inv, t) => t.deposit > 0, make: (inv, t) => ({ head: 'Deposit.',
      text: `A ${gbp(t.deposit)} deposit was paid toward the purchase price and formed part of the total ${gbp(t.paid)} paid. The vehicle was removed from sale and reserved for the buyer following payment of the deposit.` }) },

    deposit_terms: { label: 'Deposit refund terms', when: (inv, t) => t.deposit > 0, make: (inv, t) => inv.deposit_nonrefundable === false
      ? { head: 'Deposit terms.', text: `The ${gbp(t.deposit)} deposit is refundable in full if the buyer decides not to go ahead before the purchase is completed.` }
      : { head: 'Deposit terms.', text: `The ${gbp(t.deposit)} deposit was agreed as non-refundable if the buyer chose not to proceed with the purchase or otherwise failed to complete the purchase, except where the buyer had a legal right to a refund that could not lawfully be excluded.` } },

    deposit_received: { label: 'Deposit received', make: (inv, t) => ({ head: 'Deposit received.',
      text: `MBU Sales Limited confirms receipt of ${t.deposit > 0 ? 'a ' + gbp(t.deposit) + ' deposit' : gbp(t.paid)} toward the agreed price of ${gbp(t.due)}. The vehicle has been removed from sale and reserved for the buyer.` }) },

    outstanding: { label: 'What’s been paid so far', make: (inv, t) => ({ head: 'Payment so far.',
      text: `${gbp(t.paid)} has been paid toward the agreed price of ${gbp(t.due)}, leaving ${gbp(t.balance)} to pay.` }) },

    balance_due: { label: 'When the balance is due', when: (inv, t) => t.balance > 0, make: (inv, t) => ({ head: 'Balance.',
      text: `The remaining balance of ${gbp(t.balance)} is due ${dueWords(inv)}, in cleared funds.` }) },

    reservation: { label: 'How long the car is held', when: inv => has(inv.balance_due_date), make: inv => ({ head: 'Reservation.',
      text: `The vehicle will be held for the buyer until ${longDate(inv.balance_due_date)}. If the balance has not been paid by then, MBU Sales Limited may offer the vehicle for sale again, and the deposit terms above apply.` }) },

    // Only when the car hasn't been handed over: keeping it until it's paid
    // for is ordinary. Never on an instalment plan (see plan_settlement).
    release: { label: 'Car released once paid', when: (inv, t) => t.balance > 0, make: () => ({ head: 'Collection.',
      text: 'The vehicle will be released to the buyer once the balance has been received in cleared funds.' }) },

    px: { label: 'Part exchange', when: inv => inv.px && inv.px.on, make: (inv, t) => {
      const v = [plate(inv.px.registration), vehicleName(inv.px)].filter(has).join(', ');
      return { head: 'Part exchange.',
        text: `The buyer’s vehicle${v ? ' (' + v + ')' : ''} was accepted in part exchange at an agreed value of ${gbp(t.px)}, deducted from the price. The buyer confirms they own it, that there is no outstanding finance on it unless declared to MBU Sales Limited in writing, and that what they told us about it is accurate.` };
    } },

    extras: { label: 'Extras included', when: (inv, t) => t.extras.some(x => Number(x.amount) > 0), make: (inv, t) => ({ head: 'Included in the price.',
      text: `The total includes ${listWords(t.extras.filter(x => Number(x.amount) > 0).map(x => `${x.label || 'an extra'} (${gbp(x.amount)})`))}.` }) },

    payment_record: { label: 'Keep proof of payment', make: (inv) => inv.kind === 'instalments'
      ? { head: 'Payment record.', text: 'Each cleared payment received will reduce the outstanding balance. The buyer should retain evidence of all payments made.' }
      : { head: 'Payment confirmation.', text: 'This invoice records the agreed sale price and confirms the payments received for the above vehicle.' } },

    plan_outstanding: { label: 'Outstanding balance', make: (inv, t) => ({ head: 'Outstanding balance.',
      text: `The parties confirm that ${gbp(t.balance)} remains outstanding from the agreed ${gbp(t.due)} vehicle price.` }) },

    plan_payments: { label: 'The payments', make: (inv, t) => {
      const rows = planRows(inv), f = (inv.plan && inv.plan.frequency) || 'monthly';
      const s = planShape(rows, f);
      t = Object.assign({}, t, { balance: planBase(inv) });
      if (!s) return { head: 'Payments.', text: 'The buyer agrees to pay the balance in line with the schedule above.' };
      const word = FREQ_WORD[f] || 'monthly';
      const head = word.charAt(0).toUpperCase() + word.slice(1) + ' payments.';
      if (s.allSame) return { head, text: `The buyer agrees to pay ${gbp(s.each)} ${s.when}, beginning ${ukDate(rows[0].due)}, for ${countWord(s.count)} ${word} instalment${s.count === 1 ? '' : 's'} until the ${gbp(t.balance)} balance is paid in full.` };
      if (s.lastDiff) return { head, text: `The buyer agrees to pay ${gbp(s.each)} ${s.when}, beginning ${ukDate(rows[0].due)}, with a final payment of ${gbp(s.last)} on ${ukDate(rows[rows.length - 1].due)}, until the ${gbp(t.balance)} balance is paid in full.` };
      return { head, text: `The buyer agrees to pay the ${gbp(t.balance)} balance in ${countWord(s.count)} instalments on the dates and in the amounts shown in the schedule above.` };
    } },

    plan_failure: { label: 'If a payment is missed', make: () => ({ head: 'Failure to pay.',
      text: 'If the buyer fails to make an instalment when due and does not remedy the missed payment after reasonable notice, MBU Sales Limited may pursue the outstanding balance and exercise any other lawful contractual or legal remedies available to it. Nothing in this clause authorises MBU Sales Limited to take possession of the vehicle without a lawful right and appropriate process.' }) },

    plan_changes: { label: 'Changes in writing', make: () => ({ head: 'Changes to the arrangement.',
      text: 'Any extension, revised payment date or other change to this instalment arrangement must be agreed in writing by MBU Sales Limited.' }) },

    plan_early: { label: 'Paying early', make: () => ({ head: 'Paying early.',
      text: 'The buyer may pay off the outstanding balance early, in full or in part, at any time, at no extra cost.' }) },

    plan_no_charges: { label: 'No interest or charges', make: () => ({ head: 'No interest or charges.',
      text: 'No interest, fees or other charges are added to the balance. The buyer pays only the outstanding amount shown above.' }) },

    // Deliberately no "the car stays ours until it's paid off" here. Keeping
    // ownership until the last payment makes it a conditional sale, and a
    // conditional sale is never covered by the 12-payment interest-free
    // exemption, however short it is (RAO art. 60F(2)).
    plan_settlement: { label: 'Fully settled when all paid', make: (inv, t) => ({ head: 'Full settlement.',
      text: `The purchase price will not be treated as fully settled until cleared funds totalling ${gbp(t.due)} have been received.` }) },

    trade_buyer: { label: 'Bought by a trader', make: () => ({ head: 'Trade sale.',
      text: 'The buyer confirms they are buying this vehicle in the course of their business as a motor trader, and not as a consumer.' }) },

    sold_as_seen: { label: 'Sold as seen', make: () => ({ head: 'Sold as seen.',
      text: 'The vehicle is sold as seen and inspected, with no warranty given or implied as to its condition, mileage or history beyond what is written on this invoice. The buyer has had the opportunity to inspect it and is satisfied with it.' }) },

    trade_payment: { label: 'Payment', make: (inv, t) => ({ head: 'Payment.',
      text: t.balance > 0 ? `${gbp(t.paid)} has been received. The remaining ${gbp(t.balance)} is due ${dueWords(inv)}.` : `Payment of ${gbp(t.due)} has been received in full.` }) },

    lawful: { label: 'Liability the law won’t let you exclude', make: () => ({ head: 'Liability.',
      text: 'Nothing in this invoice excludes or limits any liability that cannot lawfully be excluded or limited.' }) },

    buy_owner: { label: 'They own it', make: () => ({ head: 'Ownership.',
      text: 'The seller confirms they are the legal owner of the vehicle and have the right to sell it.' }) },

    buy_finance: { label: 'No finance on it', make: () => ({ head: 'Finance.',
      text: 'The seller confirms there is no outstanding finance or other debt secured on the vehicle, and will repay MBU Sales Limited any amount needed to clear one later found.' }) },

    buy_description: { label: 'Mileage and faults', make: () => ({ head: 'Description.',
      text: 'The seller confirms the recorded mileage is, to the best of their knowledge, genuine, and that they have told MBU Sales Limited about any known faults, damage or accident history.' }) },

    buy_payment: { label: 'What you paid them', make: (inv, t) => ({ head: 'Payment.',
      text: t.balance > 0 ? `MBU Sales Limited has paid ${gbp(t.paid)} to the seller. The remaining ${gbp(t.balance)} will be paid ${dueWords(inv)}.`
        : `MBU Sales Limited has paid the agreed price of ${gbp(t.due)} to the seller in full and final settlement.` }) },

    buy_documents: { label: 'Logbook and keys', make: () => ({ head: 'Documents.',
      text: 'The seller has handed over the V5C (logbook), all keys and any service records. MBU Sales Limited will tell the DVLA about the change of keeper.' }) },

    general_payment: { label: 'Payment', make: (inv, t) => ({ head: 'Payment.',
      text: t.balance > 0.004 ? (t.paid > 0 ? `${gbp(t.paid)} has been received. ` : '') + `${gbp(t.balance)} is due ${dueWords(inv)}.` : `Payment of ${gbp(t.due)} has been received in full. Thank you.` }) },

    vat_margin: { label: 'VAT margin scheme', when: (inv, t, s) => !!(s && s.vat_registered), make: () => ({ head: 'VAT.',
      text: 'Second-hand goods, margin scheme. VAT is included in the price and is not shown separately.' }) },

    statutory: { label: 'Statutory rights', make: () => ({ head: 'Statutory rights.',
      text: 'Nothing in this invoice is intended to exclude or restrict any statutory consumer rights or any liability that cannot lawfully be excluded or restricted.' }) }
  };

  function dueWords(inv) {
    if (has(inv.balance_due_date)) return 'by ' + longDate(inv.balance_due_date);
    return 'on collection';
  }
  function listWords(xs) {
    return xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  }
  function countWord(n) {
    return ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'][n] || String(n);
  }

  /**
   * The terms on this invoice, in print order, each
   *   { key, label, head, text, on, edited, standard, shown }
   * `shown` = it applies to this invoice right now (a deposit term with no
   * deposit doesn't). The app lists every one that's shown, ticked or not.
   */
  function termList(inv, settings) {
    const t = totals(inv);
    const k = kindOf(inv);
    const keys = k.terms.concat((inv.extra_terms || []).filter(x => !k.terms.includes(x)));
    const changes = inv.terms || {};
    const out = keys.filter(key => TERMS[key]).map(key => {
      const def = TERMS[key];
      const shown = !def.when || !!def.when(inv, t, settings);
      const std = shown ? def.make(inv, t, settings) : { head: '', text: '' };
      const ch = changes[key] || {};
      const edited = has(ch.text) || has(ch.head);
      return { key, label: def.label, standard: k.terms.includes(key), shown, on: !ch.off,
        head: edited ? (ch.head || '') : std.head, text: edited ? (ch.text || '') : std.text, edited, std };
    });
    (inv.custom_terms || []).forEach((c, i) => {
      if (has(c.text) || has(c.head)) out.push({ key: 'custom:' + i, label: c.head || 'Your own term', custom: true, shown: true, on: !c.off, head: c.head || '', text: c.text || '', edited: true });
    });
    return out;
  }
  // Standard terms from other kinds that could be added to this one
  function otherTerms(inv) {
    const k = kindOf(inv), mine = new Set(k.terms.concat(inv.extra_terms || []));
    return Object.keys(TERMS).filter(key => !mine.has(key)).map(key => ({ key, label: TERMS[key].label }));
  }

  /* ------------------------------------------------------------- WARNINGS
     Things to look at before sending. `level`: 'red' needs fixing or a
     conscious decision, 'amber' is worth a glance. Never blocks anything. */
  const FCA_NOTE = 'An instalment sale stays outside FCA consumer credit rules only if it has 12 payments or fewer, all within 12 months of the sale, with no interest or charges. Outside that, the agreement may need FCA authorisation. Check before you use it.';

  function warnings(inv, settings) {
    const out = [];
    const t = totals(inv);
    const c = inv.customer || {};
    if (!has(c.name)) out.push({ level: 'red', field: 'customer', text: inv.kind === 'purchase' ? 'Who you bought it from isn’t filled in.' : 'The customer’s name isn’t filled in.' });
    if (inv.kind !== 'general' && !has(inv.vehicle && inv.vehicle.registration)) out.push({ level: 'amber', field: 'vehicle', text: 'No registration on it.' });
    if (!(t.due > 0) && inv.kind !== 'general') out.push({ level: 'red', field: 'money', text: 'There’s no price on it.' });
    if (inv.kind === 'general' && !(t.goods > 0)) out.push({ level: 'red', field: 'money', text: 'Add at least one line with an amount.' });
    if (t.balance < -0.004) out.push({ level: 'red', field: 'money', text: `The payments come to ${gbp(-t.balance)} more than the price.` });
    if (inv.kind === 'paid' && t.balance > 0.004) out.push({ level: 'red', field: 'money', text: `It says paid in full, but ${gbp(t.balance)} hasn’t been paid. Add the payment, or choose Balance to pay or Pay monthly.` });
    if ((inv.kind === 'deposit') && !(t.paid > 0)) out.push({ level: 'red', field: 'money', text: 'Put in the deposit they paid.' });

    if (inv.kind === 'instalments') {
      const rows = planRows(inv);
      const planned = sum(rows, r => r.amount);
      const base = planBase(inv);
      if (!(base > 0)) out.push({ level: 'red', field: 'plan', text: 'There’s no balance left to pay in instalments.' });
      else if (!rows.length) out.push({ level: 'red', field: 'plan', text: 'Set the number of payments (or the amount of each) and the first date.' });
      else {
        const fca = [];
        if (rows.length > 12) fca.push(`${rows.length} payments (the limit is 12)`);
        const sale = parseDate(inv.sale_date || inv.issue_date) || new Date();
        const limit = addMonths(sale, 12, sale.getDate());
        const last = parseDate(rows[rows.length - 1].due);
        if (last > limit) fca.push(`the last payment is ${longDate(rows[rows.length - 1].due)}, more than 12 months after the sale`);
        if (planned > base + 0.004) fca.push(`the payments add up to ${gbp(planned)}, ${gbp(planned - base)} more than the balance, which counts as a charge for credit`);
        if (fca.length) out.push({ level: 'red', field: 'plan', fca: true, text: 'Outside the interest-free limits: ' + listWords(fca) + '. ' + FCA_NOTE });
        if (planned < base - 0.004) out.push({ level: 'red', field: 'plan', text: `The payments add up to ${gbp(planned)}, ${gbp(base - planned)} short of the balance.` });
        const first = parseDate(rows[0].due);
        if (first && first < parseDate(inv.issue_date || today())) out.push({ level: 'amber', field: 'plan', text: 'The first payment date is before the date on the invoice.' });
      }
    }
    if (inv.px && inv.px.on && !(Number(inv.px.allowance) > 0)) out.push({ level: 'amber', field: 'px', text: 'Part exchange is ticked but has no value.' });
    if (settings && settings.vat_registered && !has(settings.vat_number)) out.push({ level: 'amber', field: 'settings', text: 'VAT registered is switched on in Invoice details, but there’s no VAT number.' });
    if (settings && inv.kind !== 'purchase' && t.balance > 0.004 && !(has(settings.bank_sort) && has(settings.bank_account)))
      out.push({ level: 'amber', field: 'settings', text: 'There’s money to pay but no bank details on it. Add them in Settings → Invoice details.' });
    return out;
  }

  /* ------------------------------------------------------------- DOCUMENT
     The invoice as blocks, ready to draw on screen or into a PDF:
       { title, subtitle, ref, date, logo, details: [[label, value]],
         blocks: [ { type: 'summary' | 'table' | 'terms' | 'text', title, ... } ],
         signatures: [ { who, name, png, date } ], footer: [line] } */
  function buildDoc(inv, s) {
    s = Object.assign({}, DEFAULT_SETTINGS, s || {});
    const k = kindOf(inv);
    const t = totals(inv);
    const c = inv.customer || {};
    const v = inv.vehicle || {};
    const seller = inv.seller || {};
    const purchase = inv.kind === 'purchase';
    const business = { name: s.legal_name, address: s.address };

    const details = [];
    const add = (label, value) => { if (has(value)) details.push([label, String(value)]); };
    add(purchase ? 'Date of Purchase' : inv.kind === 'general' ? 'Date' : 'Date of Sale', ukDate(inv.sale_date || inv.issue_date));
    if (purchase) {
      add('Seller', c.name || 'Not provided'); add('Seller Address', c.address || 'Not provided');
      add('Seller Phone', c.phone); add('Seller Email', c.email);
      add('Buyer', business.name); add('Buyer Address', business.address);
      add('Contact', [seller.name, seller.phone].filter(has).join(', '));
    } else {
      add('Seller', business.name); add('Seller Address', business.address);
      add('Sales Contact', [seller.name, seller.phone].filter(has).join(', '));
      add(inv.kind === 'general' ? 'Customer' : 'Buyer', c.name || 'Not provided');
      add(inv.kind === 'general' ? 'Customer Address' : 'Buyer Address', c.address || 'Not provided');
      add(inv.kind === 'general' ? 'Customer Phone' : 'Buyer Phone', c.phone);
      add(inv.kind === 'general' ? 'Customer Email' : 'Buyer Email', c.email);
    }
    if (has(v.registration) || has(v.make) || has(v.model)) {
      add('Registration', plate(v.registration));
      add('Make', v.make);
      add('Model', [v.model, v.variant].filter(has).join(' ') + (has(v.year) ? ` (${v.year})` : ''));
      add('Mileage', has(v.mileage) && Number(v.mileage) ? Number(v.mileage).toLocaleString('en-GB') + ' miles' : '');
      add('Colour', v.colour);
      add('VIN', v.vin);
    }

    const blocks = [];
    const sumRows = [];
    const row = (label, value, tone) => sumRows.push({ label, value, tone });

    if (inv.kind === 'general') {
      const lines = t.extras.map(x => [x.label || 'Item', gbp(x.amount)]);
      if (t.price) lines.unshift([vehicleName(v) || 'Vehicle', gbp(t.price)]);
      blocks.push({ type: 'table', title: 'Items', head: ['Description', 'Amount'], align: ['left', 'right'], widths: [0.7, 0.3], rows: lines });
      row('Total', gbp(t.goods), 'strong');
      if (t.paid) row('Paid', gbp(t.paid));
      row('Balance to Pay', t.balance > 0.004 ? gbp(t.balance) : gbp(0) + ' - PAID IN FULL', 'blue');
      if (t.balance > 0.004) row('Due', dueWords(inv).replace(/^by /, '').replace(/^on collection$/, 'On collection'));
    } else {
      row(purchase ? 'Agreed Purchase Price' : 'Total Agreed Vehicle Price', gbp(t.price));
      t.extras.forEach(x => row(x.label || (Number(x.amount) < 0 ? 'Discount' : 'Extra'), gbp(x.amount)));
      if (t.px) row('Part Exchange Allowance' + (has(inv.px.registration) ? ` (${plate(inv.px.registration)})` : ''), gbp(-t.px));
      if (t.extras.length || t.px) row('Total to Pay', gbp(t.due), 'strong');

      if (inv.kind === 'instalments') {
        row('Total Paid to Date', gbp(t.paid));
        row('TOTAL REMAINING BALANCE', gbp(t.balance), 'blue');
        const rows = planRows(inv), f = (inv.plan && inv.plan.frequency) || 'monthly';
        const shape = planShape(rows, f);
        const left = rows.filter(r => !r.paid_on);
        if (shape) {
          if (shape.allSame || shape.lastDiff) row((FREQ_WORD[f] || 'monthly').replace(/^./, m => m.toUpperCase()) + ' Instalment', gbp(shape.each), 'cream');
          if (left.length === rows.length) row('First Instalment Due', ukDate(rows[0].due));
          else if (left.length) row('Next Instalment Due', ukDate(left[0].due));
          row('Payment Date', f === 'monthly' ? shape.when.replace(/^on the /, '') : shape.when.replace(/^./, m => m.toUpperCase()));
          const sameLeft = left.length && left.every(r => r.amount === left[0].amount);
          row('Number of Remaining Instalments', !left.length ? 'None, all paid' : sameLeft ? `${left.length} x ${gbp(left[0].amount)}` : String(left.length));
        }
      } else {
        if (t.deposit && inv.kind !== 'deposit') row('Deposit Paid', gbp(t.deposit), 'cream');
        if (inv.kind === 'deposit') row('Deposit Paid', gbp(t.paid), 'cream');
        else row(purchase ? 'Paid to Seller' : 'Total Paid', gbp(t.paid));
        row('TOTAL REMAINING BALANCE', t.balance > 0.004 ? gbp(t.balance) : gbp(0) + ' - PAID IN FULL', 'blue');
        if (t.balance > 0.004) row('Balance Due', dueWords(inv).replace(/^by /, '').replace(/^on collection$/, 'On collection'));
      }
    }
    blocks.push({ type: 'summary', title: 'Payment Summary', rows: sumRows });

    if (inv.kind === 'instalments') {
      const rows = planRows(inv);
      if (rows.length) {
        const anyPaid = rows.some(r => r.paid_on);
        blocks.push({ type: 'table', title: 'Instalment Schedule',
          head: anyPaid ? ['Payment', 'Due Date', 'Amount', 'Paid'] : ['Payment', 'Due Date', 'Amount'],
          align: anyPaid ? ['center', 'center', 'center', 'center'] : ['center', 'center', 'center'],
          widths: anyPaid ? [0.16, 0.3, 0.27, 0.27] : [0.22, 0.45, 0.33],
          rows: rows.map((r, i) => [String(i + 1), ukDate(r.due), gbp(r.amount)].concat(anyPaid ? [r.paid_on ? ukDate(r.paid_on) : ''] : [])) });
      }
    }

    // Every payment, when there's more than one to account for
    if (t.payments.length > 1 && inv.kind !== 'instalments') {
      blocks.push({ type: 'table', title: 'Payments Received', head: ['Date', 'Paid by', 'Amount'], align: ['left', 'left', 'right'], widths: [0.3, 0.4, 0.3],
        rows: t.payments.map(p => [ukDate(p.date) || '', (p.deposit ? 'Deposit' : '') + (p.deposit && has(p.method) ? ', ' : '') + (p.method || (p.deposit ? '' : 'Payment')), gbp(p.amount)]) });
    }

    // The bank account: under the money when there's something to pay, at
    // the end when it's all paid. Not on a purchase receipt (we pay them).
    const ref = numberLabel(inv.number) || (has(c.name) ? String(c.name).trim().split(/\s+/).slice(-1)[0] : 'Your name');
    const owed = t.balance > 0.004;
    const extra = has(s.pay_details) ? String(s.pay_details).replace(/\{ref\}/g, ref) : '';
    let bank = null;
    if (!purchase && has(s.bank_sort) && has(s.bank_account)) {
      bank = { type: 'summary', title: owed ? 'How to Pay' : 'Bank Details', split: 0.4, rows: [
        { label: 'Bank Transfer To', value: s.bank_name || s.legal_name },
        { label: 'Sort Code', value: s.bank_sort },
        { label: 'Account Number', value: s.bank_account },
        { label: 'Payment Reference', value: ref }
      ].concat(extra ? [{ label: 'Also', value: extra }] : []) };
    } else if (!purchase && owed && extra) {
      bank = { type: 'text', title: 'How to Pay', text: extra };
    }
    if (bank && owed) blocks.push(bank);

    const terms = termList(inv, s).filter(x => x.shown && x.on && (has(x.text) || has(x.head)));
    if (terms.length) blocks.push({ type: 'terms', title: k.termsTitle, items: terms.map(x => ({ head: x.head, text: x.text })) });
    if (has(inv.notes)) blocks.push({ type: 'text', title: 'Additional Notes', text: String(inv.notes) });
    if (bank && !owed) blocks.push(bank);

    const sig = inv.signatures || {};
    const signatures = purchase
      ? [{ who: 'Seller', name: c.name, png: sig.buyer && sig.buyer.png, date: sig.buyer && sig.buyer.date },
         { who: 'Buyer', name: seller.name || '', png: sig.seller && sig.seller.png, date: sig.seller && sig.seller.date, forLine: business.name }]
      : [{ who: inv.kind === 'general' ? 'Customer' : 'Buyer', name: c.name, png: sig.buyer && sig.buyer.png, date: sig.buyer && sig.buyer.date },
         { who: 'Seller', name: seller.name || '', png: sig.seller && sig.seller.png, date: sig.seller && sig.seller.date, forLine: business.name }];

    const footer = [[s.trading_name, s.address, s.email, s.website].filter(has).join('  ·  ')];
    const opts = inv.options || {};
    if (opts.company && has(s.company_number)) footer.push([`${s.legal_name}. Registered in England and Wales, company no. ${s.company_number}`, has(s.registered_office) ? `Registered office: ${s.registered_office}` : ''].filter(has).join('  ·  '));
    if (s.vat_registered && has(s.vat_number)) footer.push(`VAT registration no. ${s.vat_number}`);

    return {
      title: has(inv.title) ? inv.title : k.title,
      subtitle: has(inv.subtitle) ? inv.subtitle : k.subtitle,
      ref: numberLabel(inv.number),
      date: ukDate(inv.issue_date || today()),
      voided: inv.status === 'void',
      details, blocks, signatures, footer
    };
  }

  const DEFAULT_SETTINGS = {
    trading_name: 'MBU Car Sales',
    legal_name: 'MBU Sales Limited',
    address: '587 Westgate Road, Newcastle upon Tyne, NE4 9PQ',
    email: 'mbusales39@gmail.com',
    website: 'mbucarsales.co.uk',
    sellers: [],
    company_number: '15943902',
    registered_office: '53 Cedar Road, Newcastle upon Tyne, NE4 9XY',
    company_default: false,
    vat_registered: false,
    vat_number: '',
    // The business bank account, printed on every invoice so nobody has to
    // send it separately. Kept in the database (Invoice details), never in
    // this file: everything in the repository is public.
    bank_name: 'MBU Sales Limited',
    bank_sort: '',
    bank_account: '',
    pay_details: ''
  };

  /* ------------------------------------------------------------ ON SCREEN */
  const escH = x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function toHtml(doc, logoUrl) {
    const blk = b => {
      const h = `<div class="inv-bar">${escH(b.title.toUpperCase())}</div>`;
      if (b.type === 'summary') return h + `<table class="inv-kv inv-kv--sum"${b.split ? ` style="--split:${b.split * 100}%"` : ''}>${b.rows.map(r =>
        `<tr class="${r.tone ? 'is-' + r.tone : ''}"><th>${escH(r.label)}</th><td>${escH(r.value)}</td></tr>`).join('')}</table>`;
      if (b.type === 'table') return h + `<table class="inv-grid"><thead><tr>${b.head.map((x, i) => `<th style="text-align:${b.align[i]};width:${b.widths[i] * 100}%">${escH(x)}</th>`).join('')}</tr></thead>
        <tbody>${b.rows.map(r => `<tr>${r.map((x, i) => `<td style="text-align:${b.align[i]}">${escH(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      if (b.type === 'terms') return h + `<ol class="inv-terms">${b.items.map((x, i) =>
        `<li><b>${i + 1}. ${escH(x.head)}</b> ${escH(x.text)}</li>`).join('')}</ol>`;
      return h + `<p class="inv-text">${escH(b.text).replace(/\n/g, '<br>')}</p>`;
    };
    return `<div class="inv-page${doc.voided ? ' is-void' : ''}">
      ${logoUrl ? `<img class="inv-logo" src="${escH(logoUrl)}" alt="MBU Car Sales">` : ''}
      <h1 class="inv-title">${escH(doc.title)}</h1>
      <div class="inv-sub"><span>${escH(doc.subtitle || '')}</span><span>${doc.ref ? 'No. ' + escH(doc.ref) + '  ·  ' : ''}Issued ${escH(doc.date)}</span></div>
      <table class="inv-kv">${doc.details.map(([l, v]) => `<tr><th>${escH(l)}</th><td>${escH(v)}</td></tr>`).join('')}</table>
      ${doc.blocks.map(blk).join('')}
      <div class="inv-sigs">${doc.signatures.map(s => `
        <div class="inv-sig">
          <div class="inv-sig-row"><b>${escH(s.who)} Signature:</b><span class="inv-sig-line">${s.png ? `<img src="${escH(s.png)}" alt="Signed">` : ''}</span><b>Date:</b><span class="inv-sig-date">${escH(s.png ? ukDate(s.date) : '')}</span></div>
          <div class="inv-sig-row"><b>${s.forLine ? 'For:' : escH(s.who) + ' Name:'}</b><span>${escH(s.forLine || s.name || '')}</span></div>
          ${s.forLine && s.name ? `<div class="inv-sig-row"><b>Name:</b><span>${escH(s.name)}</span></div>` : ''}
        </div>`).join('')}
      </div>
      <div class="inv-foot">${doc.footer.map(l => `<div>${escH(l)}</div>`).join('')}</div>
      ${doc.voided ? '<div class="inv-void">VOID</div>' : ''}
    </div>`;
  }

  /* ------------------------------------------------------------------ PDF
     Drawn with jsPDF's built-in Helvetica (the same face as the invoices
     made so far), so there's no font file to download. Helvetica only knows
     Western European letters: anything else is swapped for its plain form
     (ł → l) or a ?, rather than coming out as garbage. A4, millimetres. */
  const WIN = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
  function pdfSafe(s) {
    return String(s == null ? '' : s).replace(/−/g, '-').replace(/[  ]/g, ' ').replace(/[^\x00-\xFF]/g, ch => {
      if (WIN.has(ch)) return ch;
      const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (/^[\x20-\x7E]$/.test(plain)) return plain;
      return ({ 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ı': 'i', 'ø': 'o' })[ch] || '?';
    });
  }

  const C = {
    navy: [15, 34, 70], title: [23, 48, 94], ink: [16, 23, 36], ink2: [56, 65, 79], ink3: [110, 118, 136],
    line: [220, 225, 233], label: [244, 246, 250], blue: [232, 239, 250], blueInk: [23, 48, 94], cream: [253, 243, 223]
  };

  /**
   * @param doc     from buildDoc
   * @param JsPDF   the jsPDF constructor (window.jspdf.jsPDF, or require('jspdf').jsPDF)
   * @param assets  { logo: dataURL, logoRatio: width/height }
   * @returns the jsPDF document; .output('blob') for the file
   */
  function toPdf(doc, JsPDF, assets) {
    assets = assets || {};
    const pdf = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
    pdf.setProperties({ title: pdfSafe(doc.title + (doc.ref ? ' ' + doc.ref : '')), author: 'MBU Sales Limited', creator: 'MBU Admin' });
    const W = 210, H = 297, M = 15, CW = W - 2 * M, FOOT = 18;
    const PT = 0.3528, LH = 1.38;
    let y = 14;
    const col = c => pdf.setTextColor(c[0], c[1], c[2]);
    const fill = c => pdf.setFillColor(c[0], c[1], c[2]);
    const stroke = c => pdf.setDrawColor(c[0], c[1], c[2]);
    const font = (style, size) => { pdf.setFont('helvetica', style); pdf.setFontSize(size); };
    const lh = size => size * PT * LH;
    const room = h => { if (y + h > H - FOOT) { pdf.addPage(); y = 16; return true; } return false; };
    const wrap = (text, width) => pdf.splitTextToSize(pdfSafe(text), width);

    // Logo, title, subtitle
    if (assets.logo) {
      const lw = 58, lhgt = lw / (assets.logoRatio || 3.03);
      pdf.addImage(assets.logo, 'PNG', (W - lw) / 2, y, lw, lhgt, 'logo', 'FAST');
      y += lhgt + 7;
    }
    font('bold', 19); col(C.title);
    wrap(doc.title.toUpperCase(), CW - 10).forEach(l => { pdf.text(l, W / 2, y + 5, { align: 'center' }); y += lh(19); });
    y += 2;
    font('normal', 9.5); col(C.ink2);
    if (doc.subtitle) pdf.text(pdfSafe(doc.subtitle), M, y + 3);
    pdf.text(pdfSafe((doc.ref ? 'No. ' + doc.ref + '   ·   ' : '') + 'Issued ' + doc.date), W - M, y + 3, { align: 'right' });
    y += 6;

    // Label | value table (details and the money summary)
    function kv(rows, opts) {
      opts = opts || {};
      const x = M + (opts.inset || 0), w = CW - 2 * (opts.inset || 0), lw = w * (opts.split || 0.315), pad = KV_PAD;
      rows.forEach(r => {
        const tone = r.tone;
        font('bold', 9.5);
        const L = wrap(r.label, lw - 2 * pad);
        font(opts.boldValues || tone ? 'bold' : 'normal', 9.5);
        const V = wrap(r.value, w - lw - 2 * pad);
        const h = Math.max(L.length, V.length) * lh(9.5) + 2 * pad;
        room(h);
        fill(tone === 'blue' ? C.blue : tone === 'cream' ? C.cream : C.label); pdf.rect(x, y, lw, h, 'F');
        if (tone === 'blue' || tone === 'cream') { pdf.rect(x + lw, y, w - lw, h, 'F'); }
        stroke(C.line); pdf.setLineWidth(0.25); pdf.rect(x, y, lw, h); pdf.rect(x + lw, y, w - lw, h);
        font('bold', 9.5); col(tone === 'blue' ? C.blueInk : C.ink);
        L.forEach((l, i) => pdf.text(l, x + pad, y + pad + 3.1 + i * lh(9.5)));
        font(opts.boldValues || tone ? 'bold' : 'normal', 9.5); col(tone === 'blue' ? C.blueInk : C.ink);
        V.forEach((l, i) => pdf.text(l, x + lw + pad, y + pad + 3.1 + i * lh(9.5)));
        y += h;
      });
    }
    function bar(title) {
      room(9 + 12);   // never leave a heading alone at the foot of a page
      fill(C.navy); pdf.rect(M - 3, y, CW + 6, 8.6, 'F');
      font('bold', 11); pdf.setTextColor(255, 255, 255);
      pdf.text(pdfSafe(title.toUpperCase()), M, y + 5.8);
      y += 8.6;
    }
    function grid(b) {
      const x = M + 6, w = CW - 12, pad = GRID_PAD;
      const widths = b.widths.map(f => f * w);
      const head = () => {
        fill(C.navy); pdf.rect(x, y, w, 7.4, 'F');
        font('bold', 9.5); pdf.setTextColor(255, 255, 255);
        let cx = x;
        b.head.forEach((t, i) => { cellText(t, cx, widths[i], y + 5, b.align[i]); cx += widths[i]; });
        y += 7.4;
      };
      head();
      font('normal', 9.5);
      b.rows.forEach(r => {
        const lines = r.map((t, i) => wrap(t, widths[i] - 2 * pad));
        const h = Math.max(...lines.map(l => l.length)) * lh(9.5) + 2 * pad + 0.6;
        if (room(h)) head();
        stroke(C.line); pdf.setLineWidth(0.25);
        let cx = x;
        font('normal', 9.5); col(C.ink);
        lines.forEach((ls, i) => {
          pdf.rect(cx, y, widths[i], h);
          ls.forEach((l, j) => cellText(l, cx, widths[i], y + pad + 3.3 + j * lh(9.5), b.align[i]));
          cx += widths[i];
        });
        y += h;
      });
    }
    function cellText(t, cx, cw, ty, align) {
      const s = pdfSafe(t), pad = 2.2;
      if (align === 'center') pdf.text(s, cx + cw / 2, ty, { align: 'center' });
      else if (align === 'right') pdf.text(s, cx + cw - pad, ty, { align: 'right' });
      else pdf.text(s, cx + pad, ty);
    }
    // A paragraph that starts in bold ("1. Outstanding balance.") and carries
    // on in regular, wrapped word by word across both
    function rich(segs, x, width, size) {
      const words = [];
      segs.forEach(sg => pdfSafe(sg.text).split(/(\s+)/).forEach(w => { if (w && !/^\s+$/.test(w)) words.push({ w, bold: sg.bold }); }));
      const lines = [[]];
      let lineW = 0;
      words.forEach(wd => {
        font(wd.bold ? 'bold' : 'normal', size);
        const ww = pdf.getTextWidth(wd.w), sp = pdf.getTextWidth(' ');
        if (lineW && lineW + sp + ww > width) { lines.push([]); lineW = 0; }
        lines[lines.length - 1].push(wd);
        lineW += (lineW ? sp : 0) + ww;
      });
      lines.forEach(ln => {
        room(lh(size));
        let cx = x;
        ln.forEach((wd, i) => {
          font(wd.bold ? 'bold' : 'normal', size); col(C.ink);
          if (i) cx += pdf.getTextWidth(' ');
          pdf.text(wd.w, cx, y + 3.2);
          cx += pdf.getTextWidth(wd.w);
        });
        y += lh(size);
      });
    }

    // A money summary or a schedule is read as one thing, so it never splits
    // across a page when it would fit whole on the next one
    const KV_PAD = 1.9, GRID_PAD = 1.7;
    const rowH = pad => lh(9.5) + 2 * pad;
    function wholeHeight(b) {
      if (b.type === 'summary') return 10 + b.rows.length * rowH(KV_PAD);
      if (b.type === 'table') return 10 + 7.4 + b.rows.length * (rowH(GRID_PAD) + 0.6);
      return 0;
    }

    kv(doc.details.map(([label, value]) => ({ label, value })), { inset: 7 });
    y += 2;
    doc.blocks.forEach(b => {
      y += 1.5;
      const whole = wholeHeight(b);
      if (whole && y + whole > H - FOOT && whole < H - FOOT - 16) { pdf.addPage(); y = 16; }
      bar(b.title);
      y += 1;
      if (b.type === 'summary') kv(b.rows, { inset: 7, split: b.split || 0.6, boldValues: true });
      else if (b.type === 'table') grid(b);
      else if (b.type === 'terms') {
        y += 1;
        b.items.forEach((it, i) => {
          rich([{ text: `${i + 1}. ${it.head}`, bold: true }, { text: ' ' + it.text, bold: false }], M, CW, 9.6);
          y += 1.8;
        });
      } else {
        y += 1;
        String(b.text).split('\n').forEach(par => {
          font('normal', 9.6); col(C.ink);
          wrap(par || ' ', CW).forEach(l => { room(lh(9.6)); pdf.text(l, M, y + 3.2); y += lh(9.6); });
        });
        y += 1;
      }
    });

    // Signatures: an image where someone signed on the phone, a line where not.
    // Kept together: both on this page if they fit, otherwise both on the next.
    y += 5;
    const sigH = sg => 15 + (sg.forLine && sg.name ? 6 : 0) + 7;
    const allSigs = doc.signatures.reduce((a, sg) => a + sigH(sg), 0);
    room(allSigs);
    doc.signatures.forEach(sg => {
      room(sigH(sg));
      const x0 = M + 14, lineX = M + 62, lineW = 62, dateX = lineX + lineW + 10;
      font('bold', 10); col(C.ink);
      pdf.text(pdfSafe(sg.who + ' Signature:'), x0, y + 8);
      if (sg.png) {
        try { pdf.addImage(sg.png, 'PNG', lineX, y - 3, lineW, 13, undefined, 'FAST'); } catch (e) { /* a bad image leaves the line blank */ }
      }
      stroke(C.ink3); pdf.setLineWidth(0.3);
      pdf.line(lineX, y + 9, lineX + lineW, y + 9);
      pdf.text('Date:', dateX, y + 8);
      pdf.line(dateX + 18, y + 9, dateX + 40, y + 9);
      if (sg.png && sg.date) { font('normal', 10); pdf.text(ukDate(sg.date), dateX + 19, y + 8); }
      y += 15;
      font('bold', 10); pdf.text(sg.forLine ? 'For:' : pdfSafe(sg.who + ' Name:'), x0, y);
      font('normal', 10); pdf.text(pdfSafe(sg.forLine || sg.name || ''), lineX, y);
      if (sg.forLine && sg.name) { y += 6; font('bold', 10); pdf.text('Name:', x0, y); font('normal', 10); pdf.text(pdfSafe(sg.name), lineX, y); }
      y += 7;
    });

    // Footer and page numbers on every page; VOID across a voided one
    const pages = pdf.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      pdf.setPage(p);
      stroke(C.line); pdf.setLineWidth(0.3); pdf.line(M, H - FOOT + 3, W - M, H - FOOT + 3);
      font('normal', 7.4); col(C.ink3);
      doc.footer.forEach((l, i) => pdf.text(pdfSafe(l), W / 2, H - FOOT + 7.5 + i * 3.6, { align: 'center', maxWidth: CW }));
      if (pages > 1) pdf.text(`Page ${p} of ${pages}`, W - M, H - 5, { align: 'right' });
      if (doc.voided) {
        font('bold', 90); pdf.setTextColor(220, 60, 50);
        pdf.text('VOID', W / 2, H / 2, { align: 'center', angle: 30 });
      }
    }
    return pdf;
  }

  /* ---------------------------------------------------------------- EMAIL */
  function emailText(inv, s) {
    s = Object.assign({}, DEFAULT_SETTINGS, s || {});
    const k = kindOf(inv), t = totals(inv), c = inv.customer || {}, v = inv.vehicle || {};
    const first = String(c.name || '').trim().split(/\s+/)[0] || 'there';
    const car = [v.year, vehicleName(v)].filter(has).join(' ');
    const carRef = car + (has(v.registration) ? ` (${plate(v.registration)})` : '');
    const doc = has(inv.title) ? inv.title : k.title;
    const ref = numberLabel(inv.number);
    const subject = `${doc}${ref ? ' ' + ref : ''}${carRef.trim() ? ': ' + carRef.trim() : ''} | ${s.trading_name}`;
    const lines = [`Hi ${first},`, ''];
    if (inv.kind === 'purchase') lines.push(`Thank you for selling your ${car || 'car'} to us. Your purchase receipt is attached.`);
    else if (inv.kind === 'deposit') lines.push(`Thank you for your deposit on the ${car || 'car'}. It’s reserved for you, and your receipt is attached.`);
    else if (inv.kind === 'general') lines.push(`Please find your invoice attached${ref ? ' (' + ref + ')' : ''}.`);
    else lines.push(`Thank you for buying your ${car || 'car'} from us. Your ${inv.kind === 'instalments' ? 'agreement and payment schedule are' : 'invoice is'} attached${ref ? ' (' + ref + ')' : ''}.`);
    if (inv.kind === 'instalments') {
      const rows = planRows(inv).filter(r => !r.paid_on);
      if (rows.length) lines.push('', `Your next payment of ${gbp(rows[0].amount)} is due on ${longDate(rows[0].due)}.`);
    } else if (t.balance > 0.004 && inv.kind !== 'purchase') {
      lines.push('', `The remaining balance of ${gbp(t.balance)} is due ${dueWords(inv)}.`);
    }
    if (t.balance > 0.004 && inv.kind !== 'purchase' && has(s.bank_sort) && has(s.bank_account)) {
      lines.push('', `You can pay by bank transfer to ${s.bank_name || s.legal_name}, sort code ${s.bank_sort}, account number ${s.bank_account}, using ${ref || 'your name'} as the reference. The details are on the ${inv.kind === 'instalments' ? 'agreement' : 'invoice'} too.`);
    }
    const seller = inv.seller || {};
    lines.push('', `If anything on it doesn’t look right, just reply to this email${has(seller.phone) ? ' or call me on ' + seller.phone : ''}.`, '',
      'Kind regards,', ...(has(seller.name) ? [seller.name] : []), s.trading_name, [seller.phone, s.website].filter(has).join('  ·  '));
    return { subject, body: lines.join('\n') };
  }

  function fileName(inv) {
    const c = inv.customer || {}, v = inv.vehicle || {};
    const bits = [numberLabel(inv.number) || 'MBU-invoice', plate(v.registration).replace(/\s+/g, ''), String(c.name || '').trim().split(/\s+/).slice(-1)[0]]
      .filter(has).map(x => String(x).replace(/[^A-Za-z0-9-]+/g, ''));
    return bits.filter(Boolean).join('-') + '.pdf';
  }

  return { KINDS, KIND_ORDER, TERMS, DEFAULT_SETTINGS, FCA_NOTE,
    totals, makeSchedule, planRows, planBase, warnings, termList, otherTerms, buildDoc, toHtml, toPdf, emailText, fileName,
    gbp, ukDate, longDate, isoDate, parseDate, today, plate, numberLabel, pdfSafe, r2 };
});
