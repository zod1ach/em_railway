"""
3D Cable Field Blueprint
Handles routes for 3D cable field calculations along a route
"""
from flask import Blueprint, request, jsonify, session, send_file
import folium
from folium.plugins import Draw
import numpy as np
import io
import csv
from calculations.plot_utils import create_dark_figure, style_dark_axes, fig_to_base64

# Try to import pygeomag for WMM
try:
    from pygeomag import GeoMag
    WMM_AVAILABLE = True
except ImportError:
    WMM_AVAILABLE = False

bp = Blueprint('cable_3d', __name__, url_prefix='/cable-3d')


@bp.route('/calculate', methods=['POST'])
def calculate():
    """Start 3D cable calculation"""
    try:
        from flask import current_app

        data = request.json
        route_coords = data.get('route_coords', [])

        if not route_coords or len(route_coords) < 2:
            return jsonify({'status': 'error', 'message': 'Need at least 2 points for route'}), 400

        # Cable parameters
        r_DC = float(data.get('r_DC', 0.060))
        cable_angle = float(data.get('cable_angle', 15.119))
        cable_slope = float(data.get('cable_slope', 0))
        I_DC = float(data.get('I_DC', 1000))

        # Calculation parameters
        step_size = float(data.get('step_size', 100))  # meters between points
        cross_radius = float(data.get('cross_radius', 2.0))  # meters
        n_radial = int(data.get('n_radial', 50))
        n_angular = int(data.get('n_angular', 36))
        date_str = data.get('date')

        config = {
            'r_DC': r_DC,
            'cable_angle': cable_angle,
            'cable_slope': cable_slope,
            'I_DC': I_DC,
            'step_size': step_size,
            'cross_radius': cross_radius,
            'n_radial': n_radial,
            'n_angular': n_angular,
            'date': date_str
        }

        # Launch Celery task
        celery = current_app.celery
        task = celery.send_task('calculations.tasks.cable_3d_calculation_task',
                               args=[config, route_coords])

        return jsonify({
            'status': 'success',
            'task_id': task.id
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('/status/<task_id>', methods=['GET'])
def get_status(task_id):
    """Get status of 3D cable calculation task"""
    try:
        from flask import current_app
        celery = current_app.celery
        task = celery.AsyncResult(task_id)

        if task.state == 'PENDING':
            response = {
                'status': 'pending',
                'current': 0,
                'total': 1,
                'message': 'Task is waiting to start...'
            }
        elif task.state == 'PROGRESS':
            response = {
                'status': 'progress',
                'current': task.info.get('current', 0),
                'total': task.info.get('total', 1),
                'message': task.info.get('status', 'Processing...')
            }
        elif task.state == 'SUCCESS':
            result = task.result
            # Store results in session for export
            session['cable_3d_results'] = result
            response = {
                'status': 'success',
                'result': result
            }
        elif task.state == 'FAILURE':
            response = {
                'status': 'error',
                'message': str(task.info)
            }
        else:
            response = {
                'status': task.state.lower(),
                'message': f'Task state: {task.state}'
            }

        return jsonify(response)

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('/map', methods=['GET'])
def show_map():
    """Show interactive map for route selection"""
    try:
        # Create a Folium map centered on UK
        m = folium.Map(
            location=[54.5, -4.0],
            zoom_start=6,
            tiles='OpenStreetMap'
        )

        # Add Draw plugin for polyline drawing
        draw = Draw(
            export=False,
            draw_options={
                'polyline': {'allowIntersection': False},
                'polygon': False,
                'circle': False,
                'marker': False,
                'circlemarker': False,
                'rectangle': False
            }
        )
        draw.add_to(m)

        # Add JavaScript to capture drawn polyline
        draw_js = """
        <script>
        var drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        map.on(L.Draw.Event.CREATED, function(event) {
            var layer = event.layer;
            var type = event.layerType;

            // Clear previous drawings
            drawnItems.clearLayers();
            drawnItems.addLayer(layer);

            if (type === 'polyline') {
                var latlngs = layer.getLatLngs();
                var data = {
                    type: 'polyline',
                    coords: latlngs.map(function(ll) {
                        return [ll.lng, ll.lat];
                    })
                };

                // Send to parent window
                if (window.parent) {
                    window.parent.postMessage({
                        type: 'route_drawn',
                        route: data
                    }, '*');
                }
            }
        });
        </script>
        """

        # Get map HTML
        map_html = m._repr_html_()

        # Inject custom JavaScript
        map_html = map_html.replace('</body>', draw_js + '</body>')

        return map_html

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@bp.route('/export-data', methods=['GET'])
def export_data():
    """Export 3D cable calculation results as CSV"""
    try:
        if 'cable_3d_results' not in session:
            return jsonify({'status': 'error', 'message': 'No data to export. Run calculation first.'}), 400

        results = session['cable_3d_results']

        if results.get('status') != 'success':
            return jsonify({'status': 'error', 'message': 'No valid results to export'}), 400

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(['3D Cable Field Calculation Results'])
        writer.writerow(['Message', results.get('message', '')])

        # Create response
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name='cable_3d_data.csv'
        )

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
