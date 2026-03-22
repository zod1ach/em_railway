/** Haversine distance between two points in km */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Total line length in km from an array of points */
export function totalLineKm(points: { lng: number; lat: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

/**
 * Interpolate points along a polyline at equal spacing.
 * Returns the interpolated points (NOT including the original waypoints).
 */
export function interpolateLinePoints(
  waypoints: { lng: number; lat: number }[],
  nPoints: number
): { lng: number; lat: number }[] {
  if (waypoints.length < 2 || nPoints < 1) return [];

  // Build cumulative distances
  const dists: number[] = [0];
  for (let i = 1; i < waypoints.length; i++) {
    dists.push(dists[i - 1] + haversineKm(
      waypoints[i - 1].lat, waypoints[i - 1].lng,
      waypoints[i].lat, waypoints[i].lng
    ));
  }
  const totalDist = dists[dists.length - 1];
  if (totalDist === 0) return [];

  const step = totalDist / (nPoints + 1);
  const result: { lng: number; lat: number }[] = [];

  // Minimum distance from a waypoint to avoid overlap (in km)
  const minDistFromWaypoint = totalDist * 0.01; // 1% of total line length

  for (let i = 1; i <= nPoints; i++) {
    const targetDist = step * i;
    // Find segment
    let seg = 0;
    for (seg = 1; seg < dists.length; seg++) {
      if (dists[seg] >= targetDist) break;
    }
    const segStart = dists[seg - 1];
    const segEnd = dists[seg];
    const t = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;

    const pt = {
      lng: waypoints[seg - 1].lng + t * (waypoints[seg].lng - waypoints[seg - 1].lng),
      lat: waypoints[seg - 1].lat + t * (waypoints[seg].lat - waypoints[seg - 1].lat),
    };

    // Skip if too close to any waypoint
    const tooClose = waypoints.some((wp) =>
      haversineKm(wp.lat, wp.lng, pt.lat, pt.lng) < minDistFromWaypoint
    );
    if (!tooClose) {
      result.push(pt);
    }
  }

  return result;
}

/**
 * Calculate max interpolation points for team mode: 1 per 5 km
 */
export function maxTeamPoints(waypoints: { lng: number; lat: number }[]): number {
  const km = totalLineKm(waypoints);
  return Math.max(1, Math.floor(km / 5));
}
