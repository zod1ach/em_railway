"""
DC Bipole Blueprint
Handles routes for DC bipole calculations with WMM integration
"""
from flask import Blueprint, request, jsonify, render_template_string, session, send_file
import numpy as np
import folium
from folium.plugins import Draw
import json
import os
import io
import csv
from datetime import datetime
from calculations.plot_utils import plot_surface_field, fig_to_base64, create_dark_figure, style_dark_axes

# Try to import pygeomag for WMM calculations
try:
    from pygeomag import GeoMag
    WMM_AVAILABLE = True
except ImportError:
    WMM_AVAILABLE = False
    print("Warning: pygeomag not available. Using default Earth field values.")

bp = Blueprint('dc_bipole', __name__, url_prefix='/dc-bipole')


@bp.route('/calculate', methods=['POST'])
def calculate():
    """Calculate DC bipole field"""
    try:
        # Get parameters from request
        data = request.json

        # Geometry parameters
        r_DC = float(data.get('r_DC', 0.060))
        cable_angle = np.deg2rad(float(data.get('cable_angle', 15.119)))
        cable_slope = np.deg2rad(float(data.get('cable_slope', 0)))

        # Electric parameters
        I_DC = float(data.get('I_DC', 1000))

        # Earth field parameters (in nT)
        B_earth_X = float(data.get('B_earth_X', 9578)) * 1e-9  # Convert to T
        B_earth_Y = float(data.get('B_earth_Y', 2588)) * 1e-9
        B_earth_Z = float(data.get('B_earth_Z', 53601)) * 1e-9

        mu0 = 4 * np.pi * 1e-7

        # Coordinate transformation (rotation matrices)
        x_hat_cable = np.array([-np.sin(cable_angle), np.cos(cable_angle), 0])
        y_hat_cable = np.array([-np.cos(cable_angle) * np.sin(cable_slope),
                                -np.sin(cable_angle) * np.sin(cable_slope),
                                -np.cos(cable_slope)])
        z_hat_cable = np.array([np.cos(cable_angle) * np.cos(cable_slope),
                                np.sin(cable_angle) * np.cos(cable_slope),
                                -np.sin(cable_slope)])

        B_earth_matrix = np.array([B_earth_X, B_earth_Y, B_earth_Z])

        # Project Earth field onto cable coordinates
        B_earth_cable_x = np.dot(x_hat_cable, B_earth_matrix)
        B_earth_cable_y = np.dot(y_hat_cable, B_earth_matrix)
        B_earth_cable_z = np.dot(z_hat_cable, B_earth_matrix)

        B_earth = np.sqrt(B_earth_X**2 + B_earth_Y**2 + B_earth_Z**2)

        # High resolution grid (800x800)
        x = np.linspace(-1, 1, 800)
        y = np.linspace(-1, 1, 800)
        X, Y = np.meshgrid(x, y)

        # Bipole cable positions
        y_cable_1 = 0
        y_cable_2 = 0
        x_cable_1 = -r_DC
        x_cable_2 = r_DC

        # Distance from each cable
        r1 = np.sqrt((X - x_cable_1)**2 + (Y - y_cable_1)**2)
        r2 = np.sqrt((X - x_cable_2)**2 + (Y - y_cable_2)**2)

        # Bipole magnetic field (Biot-Savart for infinite wires)
        B_x = (mu0 * I_DC / (2 * np.pi)) * ((y_cable_1 - Y) / (r1**2)) - \
              (mu0 * I_DC / (2 * np.pi)) * ((y_cable_2 - Y) / (r2**2))
        B_y = (mu0 * I_DC / (2 * np.pi)) * ((X - x_cable_1) / (r1**2)) - \
              (mu0 * I_DC / (2 * np.pi)) * ((X - x_cable_2) / (r2**2))
        Bnorm_bipole = np.sqrt(B_x**2 + B_y**2)

        # Total field with Earth field (for perturbation analysis)
        B_x_per = B_x + B_earth_cable_x
        B_y_per = B_y + B_earth_cable_y
        B_z_per = B_earth_cable_z
        Bnorm_per = np.sqrt(B_x_per**2 + B_y_per**2 + B_z_per**2)

        # Perturbation ratio (log scale)
        perturbation = Bnorm_per / B_earth
        perturbation_log = np.log10(perturbation)

        # Monopole calculation (single cable at center)
        y_cable = 0
        x_cable = 0
        r_mono = np.sqrt((X - x_cable)**2 + (Y - y_cable)**2)
        B_x_mono = (mu0 * I_DC / (2 * np.pi)) * ((y_cable - Y) / (r_mono**2))
        B_y_mono = (mu0 * I_DC / (2 * np.pi)) * ((X - x_cable) / (r_mono**2))
        Bnorm_mono = np.sqrt(B_x_mono**2 + B_y_mono**2)

        # Mask internal regions
        mask_bipole = (r1 < r_DC) | (r2 < r_DC)
        mask_mono = r_mono < r_DC

        Bnorm_bipole_masked = Bnorm_bipole.copy()
        Bnorm_bipole_masked[mask_bipole] = np.nan

        perturbation_log_masked = perturbation_log.copy()
        perturbation_log_masked[mask_bipole] = np.nan

        Bnorm_mono_masked = Bnorm_mono.copy()
        Bnorm_mono_masked[mask_mono] = np.nan

        # Convert to µT
        Bnorm_bipole_uT = Bnorm_bipole_masked * 1e6
        Bnorm_mono_uT = Bnorm_mono_masked * 1e6

        # Generate plots
        plots = {}

        # Plot 1: Bipole Magnetic Field
        plots['bipole_field'] = plot_surface_field(
            X, Y, Bnorm_bipole_uT,
            'DC Bipole - Magnetic Field',
            'X Position (m)',
            'Y Position (m)',
            'Field Magnitude (µT)'
        )

        # Plot 2: Perturbation (log scale)
        fig_pert = create_dark_figure(figsize=(10, 8))
        ax_pert = fig_pert.add_subplot(111)
        pcm = ax_pert.pcolormesh(X, Y, perturbation_log_masked, cmap='RdYlBu_r', shading='auto')
        cbar = fig_pert.colorbar(pcm, ax=ax_pert, label='log₁₀(B_total/B_earth)')
        cbar.ax.yaxis.label.set_color('#e0e0e0')
        cbar.ax.tick_params(colors='#e0e0e0')
        ax_pert.set_xlabel('X Position (m)', fontsize=12)
        ax_pert.set_ylabel('Y Position (m)', fontsize=12)
        ax_pert.set_title('DC Bipole - Perturbation', fontsize=14, fontweight='bold')
        style_dark_axes(ax_pert)
        ax_pert.set_aspect('equal')
        fig_pert.tight_layout()
        plots['bipole_perturbation'] = fig_to_base64(fig_pert)

        # Plot 3: Monopole Magnetic Field
        plots['monopole_field'] = plot_surface_field(
            X, Y, Bnorm_mono_uT,
            'DC Monopole - Magnetic Field',
            'X Position (m)',
            'Y Position (m)',
            'Field Magnitude (µT)'
        )

        # Store results in session for export
        session['dc_bipole_results'] = {
            'max_bipole': float(np.nanmax(Bnorm_bipole_uT)),
            'min_bipole': float(np.nanmin(Bnorm_bipole_uT)),
            'max_monopole': float(np.nanmax(Bnorm_mono_uT)),
            'min_monopole': float(np.nanmin(Bnorm_mono_uT)),
            'earth_field': float(B_earth * 1e9)  # Convert to nT
        }

        # Store grid data for CSV export
        session['dc_bipole_grid'] = {
            'X': X.tolist(),
            'Y': Y.tolist(),
            'Bnorm_bipole': Bnorm_bipole_uT.tolist(),
            'Bnorm_mono': Bnorm_mono_uT.tolist(),
            'perturbation': perturbation_log_masked.tolist()
        }

        return jsonify({
            'status': 'success',
            'plots': plots,
            'results': session['dc_bipole_results']
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('/map', methods=['GET'])
def show_map():
    """Show interactive map for location selection"""
    try:
        # Create a Folium map centered on UK
        m = folium.Map(
            location=[54.5, -4.0],  # UK center
            zoom_start=6,
            tiles='OpenStreetMap'
        )

        # Add click event handler with JavaScript
        click_js = """
        <script>
        var marker = null;

        function onMapClick(e) {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;

            // Remove existing marker
            if (marker) {
                marker.remove();
            }

            // Add new marker
            marker = L.marker([lat, lng]).addTo(this);
            marker.bindPopup("Selected: " + lat.toFixed(4) + ", " + lng.toFixed(4)).openPopup();

            // Send coordinates to parent window
            if (window.parent) {
                window.parent.postMessage({
                    type: 'location_selected',
                    lat: lat,
                    lng: lng
                }, '*');
            }
        }

        // Wait for map to be ready
        setTimeout(function() {
            var map = document.querySelector('.folium-map');
            if (map && map._leaflet_id) {
                var leafletMap = window[Object.keys(window).find(key =>
                    window[key] && window[key]._container === map
                )];
                if (leafletMap) {
                    leafletMap.on('click', onMapClick);
                }
            }
        }, 1000);
        </script>
        """

        # Get map HTML
        map_html = m._repr_html_()

        # Inject custom JavaScript
        map_html = map_html.replace('</body>', click_js + '</body>')

        return map_html

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('/get-wmm', methods=['POST'])
def get_wmm():
    """Get WMM values for a location and date"""
    try:
        if not WMM_AVAILABLE:
            return jsonify({
                'status': 'error',
                'message': 'pygeomag not available. Please install: pip install pygeomag'
            }), 500

        data = request.json
        lat = float(data.get('lat', 50.0))
        lon = float(data.get('lon', 0.0))
        date_str = data.get('date', datetime.now().strftime('%d/%m/%Y'))

        # Parse date (DD/MM/YYYY)
        try:
            date_parts = date_str.split('/')
            day = int(date_parts[0])
            month = int(date_parts[1])
            year = int(date_parts[2])

            # Convert to decimal year for WMM
            date_obj = datetime(year, month, day)
            days_in_year = 366 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 365
            day_of_year = date_obj.timetuple().tm_yday
            decimal_year = year + (day_of_year - 1) / days_in_year
        except:
            return jsonify({
                'status': 'error',
                'message': 'Invalid date format. Use DD/MM/YYYY'
            }), 400

        # Calculate WMM
        gm = GeoMag()
        mag = gm.calculate(lat, lon, 0, decimal_year)  # altitude = 0m

        # Extract components (in nT)
        Bx = mag.x  # North component
        By = mag.y  # East component
        Bz = mag.z  # Down component (vertical)

        return jsonify({
            'status': 'success',
            'Bx': round(Bx, 2),
            'By': round(By, 2),
            'Bz': round(Bz, 2),
            'location': f"{lat:.4f}, {lon:.4f}"
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('/export-data', methods=['GET'])
def export_data():
    """Export calculation results as CSV"""
    try:
        if 'dc_bipole_grid' not in session:
            return jsonify({'status': 'error', 'message': 'No data to export. Run calculation first.'}), 400

        grid_data = session['dc_bipole_grid']
        X = np.array(grid_data['X'])
        Y = np.array(grid_data['Y'])
        Bnorm_bipole = np.array(grid_data['Bnorm_bipole'])
        Bnorm_mono = np.array(grid_data['Bnorm_mono'])
        perturbation = np.array(grid_data['perturbation'])

        # Flatten arrays
        x_flat = X.flatten()
        y_flat = Y.flatten()
        b_bipole_flat = Bnorm_bipole.flatten()
        b_mono_flat = Bnorm_mono.flatten()
        pert_flat = perturbation.flatten()

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['X (m)', 'Y (m)', 'Bipole Field (µT)', 'Monopole Field (µT)', 'Log10(Perturbation)'])

        for i in range(len(x_flat)):
            if not np.isnan(b_bipole_flat[i]):  # Skip NaN values
                writer.writerow([x_flat[i], y_flat[i], b_bipole_flat[i], b_mono_flat[i], pert_flat[i]])

        # Create response
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name='dc_bipole_data.csv'
        )

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
