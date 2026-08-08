/* ============================================================================
   AUTO TRADER CONNECT — ADAPTER (not wired up yet)
   ----------------------------------------------------------------------------
   Nothing here calls Auto Trader. This file exists so that when API access is
   switched on, the integration drops in without touching the rest of the app.

   Auto Trader Connect is included as standard in all packages, but direct API
   access has to be enabled by your Account Manager, and an Integration Manager
   walks you through "Go Live checks" first. See ROADMAP.md section 4.

   WHEN ACCESS IS GRANTED:
     1. Create a Supabase Edge Function `autotrader-proxy` holding the
        credentials (same pattern as dvla-lookup — the key must never sit in
        this file, which is public).
     2. Fill in the three functions marked TODO below.
     3. Set enabled: true in config.js.

   Everything else already speaks this interface.
   ========================================================================== */
(function () {
  'use strict';

  const CFG = window.MBU_CONFIG || {};
  const AT = window.MBU_AUTOTRADER = {};

  AT.config = Object.assign({
    enabled: false,
    advertiserId: '',
    proxyPath: '/functions/v1/autotrader-proxy',
    maxAdverts: 8            // your current package allowance
  }, CFG.autotrader || {});

  AT.isEnabled = () => !!(AT.config.enabled && AT.config.advertiserId);

  /* --------------------------------------------------------------------------
     FIELD MAPPING
     Our database columns ⇄ Auto Trader's field names. Keeping this in one
     place means their naming never leaks into the rest of the app.
     -------------------------------------------------------------------------- */
  AT.FIELD_MAP = {
    at_derivative_id:   'vehicle.derivativeId',
    registration:       'vehicle.registration',
    mileage:            'vehicle.odometerReadingMiles',
    colour:             'vehicle.colour',
    year:               'vehicle.firstRegistrationDate',
    price:              'adverts.retailAdverts.suppliedPrice.amountGBP',
    description:        'adverts.retailAdverts.description',
    at_lifecycle_state: 'metadata.lifecycleState'
  };

  /** Our status → Auto Trader lifecycle state */
  AT.LIFECYCLE = {
    draft:     'DUE_IN',
    available: 'FORECOURT',
    reserved:  'SALE_IN_PROGRESS',
    sold:      'SOLD'
  };

  /**
   * Shape one of our car records into an Auto Trader stock payload.
   * Pure data transformation — safe to build and test with no API access.
   */
  AT.toStockPayload = function (car) {
    return {
      vehicle: {
        registration: (car.registration || '').replace(/\s+/g, '').toUpperCase(),
        derivativeId: car.at_derivative_id || undefined,
        odometerReadingMiles: car.mileage ?? undefined,
        colour: car.colour || undefined
      },
      adverts: {
        retailAdverts: {
          suppliedPrice: car.price != null ? { amountGBP: car.price } : undefined,
          description: car.description || undefined,
          autotraderAdvert: { status: car.at_published ? 'PUBLISHED' : 'NOT_PUBLISHED' }
        }
      },
      metadata: {
        lifecycleState: AT.LIFECYCLE[car.status] || 'FORECOURT'
      },
      media: {
        images: (car.images || [])
          .map(i => ({ href: window.MBU ? window.MBU.img(i, 'full') : null }))
          .filter(i => i.href)
      }
    };
  };

  /* --------------------------------------------------------------------------
     THE THREE CALLS WE'D ACTUALLY MAKE — all TODO
     -------------------------------------------------------------------------- */

  /**
   * Reg → exact make/model/derivative. This is the one that finishes the job
   * the DVLA can't: the DVLA gives make, year, colour, fuel and engine size,
   * but never the model or trim.
   * TODO: POST through the Edge Function to the Taxonomy / Vehicles API.
   */
  AT.lookupDerivative = async function (/* registration */) {
    throw new Error('Auto Trader access not set up yet — see ROADMAP.md section 4.');
  };

  /**
   * Reg + mileage → retail, trade and part-exchange values, retail rating and
   * average days to sell. The auction bidding tool.
   * TODO: POST through the Edge Function to Valuations + Vehicle Metrics.
   */
  AT.getValuation = async function (/* registration, mileage */) {
    throw new Error('Auto Trader access not set up yet — see ROADMAP.md section 4.');
  };

  /**
   * Push a car to Auto Trader, or pull the advert down when it sells.
   * Must respect AT.config.maxAdverts — the package allows 8 live at once.
   * TODO: POST/PATCH through the Edge Function to the Stock API.
   */
  AT.syncStock = async function (/* car, { publish } */) {
    throw new Error('Auto Trader access not set up yet — see ROADMAP.md section 4.');
  };

  /** How many adverts we're allowed to have live, and how many are left. */
  AT.advertAllowance = function (cars) {
    const used = (cars || []).filter(c => c.at_published && c.status !== 'sold').length;
    return { used, limit: AT.config.maxAdverts, remaining: Math.max(0, AT.config.maxAdverts - used) };
  };
})();
