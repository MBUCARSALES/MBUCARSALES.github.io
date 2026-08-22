/* ============================================================================
   EQUIPMENT TAXONOMY
   ----------------------------------------------------------------------------
   Shared by the website and the admin app so both group equipment the same way.

   The categories mirror how Auto Trader groups spec, which means:
     · a well-specced car reads as tidy groups rather than a wall of 20 items
     · when the Auto Trader sync goes live, mapping is a lookup, not a guess

   IMPORTANT: storage format is unchanged. A car still stores a plain array
   like ["Air conditioning", "Sat nav"]. Grouping happens at display time, so
   nothing in the database needs migrating and anything not listed here simply
   falls into "Other equipment".
   ========================================================================== */
(function () {
  'use strict';

  const CATEGORIES = [
    {
      key: 'comfort',
      label: 'Comfort & convenience',
      items: [
        'Air conditioning', 'Climate control', 'Dual-zone climate control',
        'Heated front seats', 'Heated seats', 'Heated rear seats',
        'Heated steering wheel', 'Electric seats', 'Lumbar support',
        'Keyless entry', 'Keyless start', 'Electric windows',
        'Electric mirrors', 'Heated mirrors', 'Cruise control',
        'Adaptive cruise control', 'Automatic wipers', 'Automatic headlights',
        'Folding rear seats', 'Armrest', 'Cup holders'
      ]
    },
    {
      key: 'safety',
      label: 'Safety & security',
      items: [
        'Parking sensors', 'Parking sensors front & rear', 'Front parking sensors',
        'Rear parking sensors', 'Reversing camera', '360° camera',
        'Blind spot monitoring', 'Lane assist', 'Lane departure warning',
        'Autonomous emergency braking', 'Traffic sign recognition',
        'Tyre pressure monitoring', 'Isofix', 'Alarm', 'Immobiliser',
        'Airbags', 'Hill start assist', 'Traction control', 'ABS'
      ]
    },
    {
      key: 'tech',
      label: 'Technology & media',
      items: [
        'Sat nav', 'Apple CarPlay', 'Android Auto', 'Bluetooth', 'DAB radio',
        'Digital cockpit', 'Virtual cockpit', 'Touchscreen', 'USB',
        'Wireless charging', 'Premium sound system', 'Head-up display',
        'Voice control', 'Start/stop'
      ]
    },
    {
      key: 'exterior',
      label: 'Exterior',
      items: [
        'Alloy wheels', '17" alloy wheels', '18" alloy wheels', '19" alloy wheels',
        'LED headlights', 'Xenon headlights', 'Fog lights', 'Privacy glass',
        'Tinted windows', 'Panoramic roof', 'Panoramic glass roof', 'Sunroof',
        'Roof rails', 'Tow bar', 'Body coloured bumpers', 'Rear spoiler',
        'Heated windscreen'
      ]
    },
    {
      key: 'interior',
      label: 'Interior',
      items: [
        'Leather seats', 'Half leather', 'Alcantara', 'Cloth seats',
        'Sports seats', 'Ambient lighting', 'Leather steering wheel',
        'Boot liner', 'Floor mats'
      ]
    },
    {
      key: 'history',
      label: 'History & paperwork',
      items: [
        'Full service history', 'Part service history', 'Two keys', 'Spare wheel',
        'Owners manual', 'Recent service', 'New MOT', 'Cambelt replaced',
        'New tyres', 'Warranty included'
      ]
    }
  ];

  /* Fast lookup: normalised label → category key */
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const INDEX = {};
  CATEGORIES.forEach(cat => cat.items.forEach(item => { INDEX[norm(item)] = cat.key; }));

  /* Some sensible keyword fallbacks so custom entries still land somewhere */
  const KEYWORDS = [
    [/camera|sensor|blindspot|laneassist|airbag|isofix|alarm|immobilis/, 'safety'],
    [/nav|carplay|androidauto|bluetooth|dab|screen|usb|charg|audio|speaker|cockpit/, 'tech'],
    [/alloy|wheel|roof|light|glass|tint|towbar|spoiler|paint/, 'exterior'],
    [/leather|alcantara|seattrim|mats|interior|ambient/, 'interior'],
    [/heated|climate|aircon|airconditioning|cruise|keyless|electric|window|mirror/, 'comfort'],
    [/history|service|mot|warranty|keys|cambelt|tyres|belt/, 'history']
  ];

  function categoryFor(feature) {
    const n = norm(feature);
    if (INDEX[n]) return INDEX[n];
    for (const [re, key] of KEYWORDS) if (re.test(n)) return key;
    return 'other';
  }

  /**
   * Group a flat list of features into ordered categories.
   * @returns {Array<{key,label,items:string[]}>} only non-empty categories
   */
  function group(features) {
    const buckets = {};
    (features || []).forEach(f => {
      if (!f) return;
      const key = categoryFor(f);
      (buckets[key] = buckets[key] || []).push(f);
    });

    const out = CATEGORIES
      .filter(c => buckets[c.key] && buckets[c.key].length)
      .map(c => ({ key: c.key, label: c.label, items: buckets[c.key] }));

    if (buckets.other && buckets.other.length) {
      out.push({ key: 'other', label: 'Other equipment', items: buckets.other });
    }
    return out;
  }

  /** Every known feature, flat. Used to build the tap-to-add list in the app. */
  function all() {
    return CATEGORIES.reduce((a, c) => a.concat(c.items), []);
  }

  window.MBU_FEATURES = { CATEGORIES, categoryFor, group, all };
})();
