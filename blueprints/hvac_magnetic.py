"""
HVAC Magnetic Armour Blueprint
Handles routes for HVAC magnetic armour calculations
"""
from flask import Blueprint, request, jsonify, session, send_file
import numpy as np
import io
import csv
from calculations.fields import B_three_helices_armour, E_three_helices_armour
from calculations.armour import sheath_reduction_factor
from calculations.plot_utils import plot_surface_field, fig_to_base64

bp = Blueprint('hvac_mag', __name__, url_prefix='/hvac-mag')


@bp.route('/calculate', methods=['POST'])
def calculate():
    """Calculate HVAC magnetic armour field"""
    try:
        # Get parameters from request
        data = request.json

        # Geometry parameters
        p_c = float(data.get('p_c', 2.750))
        R_h = float(data.get('R_h', 0.060391))
        Omega = 2 * np.pi / p_c
        r_AC = float(data.get('r_AC', 0.245/2))
        d_s = float(data.get('d_s', 0.0958))

        # Armour parameters
        N = int(data.get('N', 110))
        d_f = float(data.get('d_f', 0.0056))
        d_A = float(data.get('d_A', 0.2056))
        p_A = float(data.get('p_A', 3.084))
        lay_factor = float(data.get('lay_factor', -1))

        # Materials
        mu0 = 4 * np.pi * 1e-7
        R_s = float(data.get('R_s', 2398.15e-7))
        mu_r_real = float(data.get('mu_r_real', 100))
        mu_r_imag = float(data.get('mu_r_imag', -50))
        mu_r = mu_r_real + 1j * mu_r_imag
        sigma = float(data.get('sigma', 4.03e6))

        # Electric parameters
        f = float(data.get('f', 50))
        I_AC = float(data.get('I_AC', 1000))

        # Other
        N_calc = int(data.get('N_calc', 10))
        s = float(data.get('s', 0.0892))
        t = float(data.get('t', 0.005))  # Wire thickness

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

        # Create high resolution grid (800x800)
        x_range = np.linspace(-1, 1, 800)
        y_range = np.linspace(-1, 1, 800)
        X, Y = np.meshgrid(x_range, y_range)

        # Calculate polar coordinates
        R = np.sqrt(X**2 + Y**2)
        Phi = np.arctan2(Y, X)

        # Calculate magnetic field with armour
        Z = (p_c / 2) * np.ones_like(X)
        Br, Bphi, Bz, Bnorm = B_three_helices_armour(
            X, Y, Z, R_h, Omega, phi01, phi02, phi03,
            I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma
        )

        # Calculate electric field with armour
        Er, Ephi, Ez, Enorm = E_three_helices_armour(
            X, Y, Z, R_h, Omega, phi01, phi02, phi03,
            I1, I2, I3, N_calc, N, d_f, d_A, p_A, p_c, t, lay_factor, f, mu_r, sigma, r_AC
        )

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
        plots['magnetic_surface'] = plot_surface_field(
            X, Y, Bnorm_uT,
            'Magnetic Field Magnitude (with Armour)',
            'X Position (m)',
            'Y Position (m)',
            'Field Magnitude (µT)'
        )

        # Electric field surface plot
        plots['electric_surface'] = plot_surface_field(
            X, Y, Enorm_Vm,
            'Electric Field Magnitude (with Armour)',
            'X Position (m)',
            'Y Position (m)',
            'Field Magnitude (V/m)'
        )

        # Store results in session for later export
        session['hvac_mag_results'] = {
            'max_bfield': float(np.nanmax(Bnorm_uT)),
            'min_bfield': float(np.nanmin(Bnorm_uT)),
            'max_efield': float(np.nanmax(Enorm_Vm)),
            'min_efield': float(np.nanmin(Enorm_Vm)),
            'sheath_reduction': float(sheath_reduction)
        }

        # Store grid data for CSV export
        session['hvac_mag_grid'] = {
            'X': X.tolist(),
            'Y': Y.tolist(),
            'Bnorm': Bnorm_uT.tolist(),
            'Enorm': Enorm_Vm.tolist()
        }

        return jsonify({
            'status': 'success',
            'plots': plots,
            'results': session['hvac_mag_results']
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
        if 'hvac_mag_grid' not in session:
            return jsonify({'status': 'error', 'message': 'No data to export. Run calculation first.'}), 400

        grid_data = session['hvac_mag_grid']
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
            download_name='hvac_magnetic_armour_data.csv'
        )

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
