"""
HVAC Non-Magnetic Blueprint
Handles routes for HVAC non-magnetic armour calculations
"""
from flask import Blueprint, request, jsonify, session, send_file
import numpy as np
import io
import csv
from calculations.fields import B_three_helices, A_three_helices
from calculations.armour import sheath_reduction_factor
from calculations.plot_utils import plot_surface_field, plot_radial_profile, fig_to_base64
from matplotlib.figure import Figure

bp = Blueprint('hvac_nonmag', __name__, url_prefix='/hvac-nonmag')


@bp.route('/calculate', methods=['POST'])
def calculate():
    """Calculate HVAC non-magnetic field"""
    try:
        # Get parameters from request
        data = request.json

        # Geometry parameters
        p_c = float(data.get('p_c', 2.750))  # power core lay length
        R_h = float(data.get('R_h', 0.060391))  # radius of helix
        Omega = 2 * np.pi / p_c
        r_AC = float(data.get('r_AC', 0.245/2))  # cable radius
        d_s = float(data.get('d_s', 0.0958))  # sheath diameter

        # Materials
        mu0 = 4 * np.pi * 1e-7
        R_s = float(data.get('R_s', 2398.15e-7))  # sheath resistance

        # Electric parameters
        f = float(data.get('f', 50))
        I_AC = float(data.get('I_AC', 1000))

        # Other
        N_calc = int(data.get('N_calc', 10))
        s = float(data.get('s', 0.0892))  # distance between conductor axes

        # Calculate sheath reduction
        sheath_reduction = sheath_reduction_factor(R_s, d_s, s, f)

        # Phase currents with sheath reduction
        I1 = sheath_reduction * I_AC
        I2 = sheath_reduction * I_AC * np.exp(2j * np.pi / 3)
        I3 = sheath_reduction * I_AC * np.exp(4j * np.pi / 3)

        # Phase offsets
        phi01 = 0
        phi02 = 2*np.pi/3
        phi03 = 4*np.pi/3

        # Create high resolution grid (800x800 to match PyQt6)
        x_range = np.linspace(-1, 1, 800)
        y_range = np.linspace(-1, 1, 800)
        X, Y = np.meshgrid(x_range, y_range)

        # Calculate polar coordinates
        R = np.sqrt(X**2 + Y**2)
        Phi = np.arctan2(Y, X)

        # Calculate magnetic field
        Z = (p_c / 2) * np.ones_like(X)
        Br, Bphi, Bz, Bnorm = B_three_helices(
            X, Y, Z, R_h, Omega, phi01, phi02, phi03,
            I1, I2, I3, N_calc
        )

        # Calculate electric field (from vector potential)
        Ar, Aphi, Az, Anorm = A_three_helices(
            X, Y, Z, R_h, Omega, phi01, phi02, phi03,
            I1, I2, I3, N_calc
        )
        m = -1j * 2 * np.pi * f
        Er = m * Ar
        Ephi = m * Aphi
        Ez = m * Az
        Enorm = np.sqrt(np.abs(Er)**2 + np.abs(Ephi)**2 + np.abs(Ez)**2)

        # Mask internal region (inside cable)
        mask = R < r_AC
        Bnorm_masked = Bnorm.copy()
        Bnorm_masked[mask] = np.nan
        Enorm_masked = Enorm.copy()
        Enorm_masked[mask] = np.nan

        # Convert to µT and V/m
        Bnorm_uT = np.abs(Bnorm_masked) * 1e6
        Enorm_Vm = np.abs(Enorm_masked)

        # Generate plots
        plots = {}

        # Magnetic field surface plot
        plots['surface'] = plot_surface_field(
            X, Y, Bnorm_uT,
            'Magnetic Field Magnitude',
            'X Position (m)',
            'Y Position (m)',
            'Field Magnitude (µT)'
        )

        # Electric field surface plot
        plots['electric'] = plot_surface_field(
            X, Y, Enorm_Vm,
            'Electric Field Magnitude',
            'X Position (m)',
            'Y Position (m)',
            'Field Magnitude (V/m)'
        )

        # Radial profile at phi=0
        r_profile = np.linspace(r_AC, 3, 100)
        x_profile = r_profile
        y_profile = np.zeros_like(r_profile)
        z_profile = np.zeros_like(r_profile)
        _, _, _, B_radial = B_three_helices(
            x_profile, y_profile, z_profile, R_h, Omega,
            phi01, phi02, phi03, I1, I2, I3, N_calc
        )
        plots['radial'] = plot_radial_profile(
            r_profile, np.abs(B_radial) * 1e6,
            'Radial Magnetic Field Profile (φ=0°)',
            'Radial Distance (m)',
            'Field Magnitude (µT)'
        )

        # Azimuthal profile at r=1m
        theta_profile = np.linspace(0, 2*np.pi, 100)
        r_fixed = 1.0
        x_az = r_fixed * np.cos(theta_profile)
        y_az = r_fixed * np.sin(theta_profile)
        z_az = np.zeros_like(theta_profile)
        _, _, _, B_az = B_three_helices(
            x_az, y_az, z_az, R_h, Omega,
            phi01, phi02, phi03, I1, I2, I3, N_calc
        )

        from calculations.plot_utils import plot_azimuthal_profile
        plots['azimuthal'] = plot_azimuthal_profile(
            theta_profile, np.abs(B_az) * 1e6,
            'Azimuthal Magnetic Field Profile (r=1m)',
            'Angle (degrees)',
            'Field Magnitude (µT)'
        )

        # Store results in session for later export
        session['hvac_nonmag_results'] = {
            'max_field': float(np.nanmax(Bnorm_uT)),
            'min_field': float(np.nanmin(Bnorm_uT)),
            'sheath_reduction': float(sheath_reduction),
            'max_efield': float(np.nanmax(Enorm_Vm)),
            'min_efield': float(np.nanmin(Enorm_Vm))
        }

        # Store grid data for CSV export
        session['hvac_nonmag_grid'] = {
            'X': X.tolist(),
            'Y': Y.tolist(),
            'Bnorm': Bnorm_uT.tolist(),
            'Enorm': Enorm_Vm.tolist()
        }

        return jsonify({
            'status': 'success',
            'plots': plots,
            'results': session['hvac_nonmag_results']
        })

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('/export-data', methods=['GET'])
def export_data():
    """Export calculation results as CSV"""
    try:
        if 'hvac_nonmag_grid' not in session:
            return jsonify({'status': 'error', 'message': 'No data to export. Run calculation first.'}), 400

        grid_data = session['hvac_nonmag_grid']
        X = np.array(grid_data['X'])
        Y = np.array(grid_data['Y'])
        Bnorm = np.array(grid_data['Bnorm'])
        Enorm = np.array(grid_data['Enorm'])

        # Flatten arrays
        x_flat = X.flatten()
        y_flat = Y.flatten()
        b_flat = Bnorm.flatten()
        e_flat = Enorm.flatten()

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['X (m)', 'Y (m)', 'Magnetic Field (µT)', 'Electric Field (V/m)'])

        for i in range(len(x_flat)):
            if not np.isnan(b_flat[i]):  # Skip NaN values
                writer.writerow([x_flat[i], y_flat[i], b_flat[i], e_flat[i]])

        # Create response
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name='hvac_nonmagnetic_data.csv'
        )

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
