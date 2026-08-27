(function (global) {
  'use strict';

  function validInteger(value, allowZero) {
    return Number.isInteger(value) && (allowZero ? value >= 0 : value > 0);
  }

  function validatePolicy(policy) {
    return policy && /^[A-Z]{3}$/.test(policy.currency) &&
      validInteger(policy.baseFareMinor, true) &&
      validInteger(policy.distanceStepUnits, false) &&
      validInteger(policy.distanceFareMinor, true) &&
      validInteger(policy.transferFareMinor, true) &&
      validInteger(policy.roundingMinor, false);
  }

  function calculateFare(project, route) {
    var policy = project && project.network && project.network.farePolicy;
    if (!validatePolicy(policy)) throw new TypeError('Fare policy is invalid');
    if (!route || !Number.isFinite(route.totalDistanceUnits) || route.totalDistanceUnits < 0 || !Number.isInteger(route.transferCount) || route.transferCount < 0) {
      throw new TypeError('Route metrics are invalid');
    }
    var distanceSteps = Math.ceil(route.totalDistanceUnits / policy.distanceStepUnits);
    var distanceMinor = distanceSteps * policy.distanceFareMinor;
    var transferMinor = route.transferCount * policy.transferFareMinor;
    var rawMinor = policy.baseFareMinor + distanceMinor + transferMinor;
    var totalMinor = Math.ceil(rawMinor / policy.roundingMinor) * policy.roundingMinor;
    return {
      currency: policy.currency,
      totalMinor: totalMinor,
      rawMinor: rawMinor,
      breakdown: {
        baseMinor: policy.baseFareMinor,
        distanceSteps: distanceSteps,
        distanceMinor: distanceMinor,
        transfers: route.transferCount,
        transferMinor: transferMinor,
        roundingMinor: totalMinor - rawMinor
      }
    };
  }

  var api = { calculateFare: calculateFare };
  global.RailwayFares = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
