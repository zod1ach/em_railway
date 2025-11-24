"""
Celery tasks for background processing
Used for long-running calculations (WMM, 3D Cable)
"""
from celery import current_task
import numpy as np
from datetime import datetime


def wmm_grid_calculation_task(config, bbox):
    """
    Background task for WMM grid calculation

    Args:
        config: Dict with calculation parameters (resolution, date, workers)
        bbox: Bounding box dict with lon0, lon1, lat0, lat1

    Returns:
        Dict with results and plots
    """
    try:
        from pygeomag import GeoMag

        # Extract parameters
        lon0, lon1 = bbox['lon0'], bbox['lon1']
        lat0, lat1 = bbox['lat0'], bbox['lat1']
        resolution = config.get('resolution', 0.1)
        date_str = config.get('date', datetime.now().strftime('%Y-%m-%d'))

        # Parse date to decimal year
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        decimal_year = dt.year + (dt.timetuple().tm_yday - 1) / 365.25

        # Create grid
        lons = np.arange(lon0, lon1 + resolution, resolution)
        lats = np.arange(lat0, lat1 + resolution, resolution)
        nx, ny = len(lons), len(lats)
        total_points = nx * ny

        # Initialize WMM
        geomag = GeoMag()

        # Arrays for results
        f_grid = np.zeros((ny, nx))
        h_grid = np.zeros((ny, nx))
        x_grid = np.zeros((ny, nx))
        y_grid = np.zeros((ny, nx))
        z_grid = np.zeros((ny, nx))
        d_grid = np.zeros((ny, nx))
        i_grid = np.zeros((ny, nx))

        # Calculate for each grid point
        count = 0
        for j, lat in enumerate(lats):
            for i, lon in enumerate(lons):
                # WMM calculation at sea level (0m altitude - NO GEBCO)
                result = geomag.calculate(lat, lon, 0, decimal_year)

                f_grid[j, i] = result.f
                h_grid[j, i] = result.h
                x_grid[j, i] = result.x
                y_grid[j, i] = result.y
                z_grid[j, i] = result.z
                d_grid[j, i] = result.d
                i_grid[j, i] = result.i

                count += 1

                # Update progress every 10 points
                if count % 10 == 0:
                    current_task.update_state(
                        state='PROGRESS',
                        meta={
                            'current': count,
                            'total': total_points,
                            'status': f'Calculated {count}/{total_points} points'
                        }
                    )

        # Generate plots using plot_utils
        from .plot_utils import plot_surface_field

        LON, LAT = np.meshgrid(lons, lats)

        plots = {
            'total_intensity': plot_surface_field(
                LON, LAT, f_grid,
                'Total Intensity (F)',
                'Longitude (°)',
                'Latitude (°)',
                'nT'
            ),
            'declination': plot_surface_field(
                LON, LAT, d_grid,
                'Declination (D)',
                'Longitude (°)',
                'Latitude (°)',
                '°'
            ),
            'inclination': plot_surface_field(
                LON, LAT, i_grid,
                'Inclination (I)',
                'Longitude (°)',
                'Latitude (°)',
                '°'
            )
        }

        return {
            'status': 'success',
            'plots': plots,
            'statistics': {
                'total_points': int(total_points),
                'f_max': float(np.max(f_grid)),
                'f_min': float(np.min(f_grid)),
                'f_mean': float(np.mean(f_grid))
            }
        }

    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }


def wmm_line_calculation_task(config, line_coords):
    """
    Background task for WMM line profile calculation

    Args:
        config: Dict with calculation parameters
        line_coords: List of (lon, lat) tuples defining the line

    Returns:
        Dict with results and plots
    """
    try:
        from pygeomag import GeoMag

        date_str = config.get('date', datetime.now().strftime('%Y-%m-%d'))
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        decimal_year = dt.year + (dt.timetuple().tm_yday - 1) / 365.25

        # Initialize WMM
        geomag = GeoMag()

        n_points = len(line_coords)
        results = []

        # Calculate for each point along line
        for idx, (lon, lat) in enumerate(line_coords):
            result = geomag.calculate(lat, lon, 0, decimal_year)  # 0m altitude

            results.append({
                'lon': lon,
                'lat': lat,
                'f': result.f,
                'h': result.h,
                'x': result.x,
                'y': result.y,
                'z': result.z,
                'd': result.d,
                'i': result.i
            })

            # Update progress
            if (idx + 1) % 5 == 0:
                current_task.update_state(
                    state='PROGRESS',
                    meta={
                        'current': idx + 1,
                        'total': n_points,
                        'status': f'Calculated {idx + 1}/{n_points} points'
                    }
                )

        # Generate line profile plots
        from .plot_utils import plot_radial_profile

        distances = np.arange(len(results))  # Could calculate actual distances
        f_values = np.array([r['f'] for r in results])
        x_values = np.array([r['x'] for r in results])
        z_values = np.array([r['z'] for r in results])

        plots = {
            'total_intensity': plot_radial_profile(
                distances, f_values,
                'Total Intensity Along Route',
                'Distance Along Line (points)',
                'F (nT)'
            ),
            'components': plot_radial_profile(
                distances, [x_values, z_values],
                'Field Components Along Route',
                'Distance Along Line (points)',
                'Field (nT)',
                labels=['X (North)', 'Z (Down)']
            )
        }

        return {
            'status': 'success',
            'plots': plots,
            'results': results
        }

    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }


def cable_3d_calculation_task(config, route_coords):
    """
    Background task for 3D cable field calculation

    Args:
        config: Dict with cable and calculation parameters
        route_coords: List of (lon, lat) tuples defining cable route

    Returns:
        Dict with results and plots
    """
    try:
        from pygeomag import GeoMag
        from .plot_utils import create_dark_figure, style_dark_axes, fig_to_base64

        # Extract parameters
        r_DC = config.get('r_DC', 0.060)
        I_DC = config.get('I_DC', 1000)
        cross_radius = config.get('cross_radius', 2.0)
        n_radial = config.get('n_radial', 50)
        n_angular = config.get('n_angular', 36)
        date_str = config.get('date', datetime.now().strftime('%Y-%m-%d'))

        # Parse date
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        decimal_year = dt.year + (dt.timetuple().tm_yday - 1) / 365.25

        # Initialize WMM
        geomag = GeoMag()
        mu0 = 4 * np.pi * 1e-7

        n_points = len(route_coords)
        slice_data = []

        # Calculate for each point along route
        for idx, (lon, lat) in enumerate(route_coords):
            # Get Earth field at this location
            mag = geomag.calculate(lat, lon, 0, decimal_year)
            B_earth = np.sqrt(mag.x**2 + mag.y**2 + mag.z**2)

            # Create cross-section grid (polar coordinates)
            r_vals = np.linspace(r_DC, cross_radius, n_radial)
            theta_vals = np.linspace(0, 2*np.pi, n_angular)
            R, THETA = np.meshgrid(r_vals, theta_vals)

            # Simplified bipole approximation at this cross-section
            # B ~ (mu0 * I) / (2 * pi * r) with directional modulation
            B_cable = (mu0 * I_DC) / (2 * np.pi * R)
            B_modulated = B_cable * (1 + 0.5 * np.cos(THETA))  # Simple directional pattern

            # Field ratio
            field_ratio = (B_cable * 1e9) / B_earth  # Convert to nT and ratio

            slice_data.append({
                'lon': lon,
                'lat': lat,
                'B_earth': B_earth,
                'max_field': float(np.max(B_cable * 1e9)),
                'min_field': float(np.min(B_cable * 1e9))
            })

            # Update progress
            if (idx + 1) % max(1, n_points // 10) == 0:
                current_task.update_state(
                    state='PROGRESS',
                    meta={
                        'current': idx + 1,
                        'total': n_points,
                        'status': f'Calculated {idx + 1}/{n_points} cross-sections'
                    }
                )

        # Generate summary plot - field along route
        fig = create_dark_figure(figsize=(10, 6))
        ax = fig.add_subplot(111)

        distances = np.arange(len(slice_data))
        max_fields = [s['max_field'] for s in slice_data]
        earth_fields = [s['B_earth'] for s in slice_data]

        ax.plot(distances, max_fields, linewidth=2, color='#14ffec', label='Cable Field (max)')
        ax.plot(distances, earth_fields, linewidth=2, color='#ff6b6b', label='Earth Field', linestyle='--')

        ax.set_xlabel('Distance Along Route (points)', fontsize=12)
        ax.set_ylabel('Field Magnitude (nT)', fontsize=12)
        ax.set_title('Magnetic Field Along Cable Route', fontsize=14, fontweight='bold')
        ax.legend(facecolor='#2a2a2a', edgecolor='#404040')
        ax.grid(True, alpha=0.2, color='#e0e0e0')
        style_dark_axes(ax)
        fig.tight_layout()

        plot_route = fig_to_base64(fig)

        return {
            'status': 'success',
            'message': f'3D Cable calculation complete for {n_points} points',
            'plots': {
                'route_profile': plot_route
            },
            'statistics': {
                'n_points': n_points,
                'max_cable_field': float(max(max_fields)),
                'mean_earth_field': float(np.mean(earth_fields))
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            'status': 'error',
            'message': str(e)
        }
