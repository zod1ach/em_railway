"""
WMM Geomagnetic Blueprint
Handles routes for WMM geomagnetic field calculations with Celery background tasks
"""
from flask import Blueprint, request, jsonify, session, send_file
import folium
from folium.plugins import Draw
import json
import io
import csv
import numpy as np

bp = Blueprint('wmm', __name__, url_prefix='/wmm')


@bp.route('/calculate', methods=['POST'])
def calculate():
    """Start WMM calculation as background task"""
    try:
        from calculations import tasks
        from flask import current_app

        data = request.json
        mode = data.get('mode', 'grid')  # 'grid' or 'line'

        if mode == 'grid':
            # Grid mode calculation
            bbox = {
                'lon0': float(data.get('lon0')),
                'lon1': float(data.get('lon1')),
                'lat0': float(data.get('lat0')),
                'lat1': float(data.get('lat1'))
            }
            resolution = float(data.get('resolution', 0.1))
        else:
            # Line mode calculation
            line_coords = data.get('line_coords', [])
            if not line_coords:
                return jsonify({'status': 'error', 'message': 'No line coordinates provided'}), 400

        date_str = data.get('date')
        workers = int(data.get('workers', 1))

        config = {
            'date': date_str,
            'resolution': resolution if mode == 'grid' else None,
            'workers': workers
        }

        # Launch Celery task
        celery = current_app.celery
        if mode == 'grid':
            task = celery.send_task('calculations.tasks.wmm_grid_calculation_task',
                                   args=[config, bbox])
        else:
            task = celery.send_task('calculations.tasks.wmm_line_calculation_task',
                                   args=[config, line_coords])

        return jsonify({
            'status': 'success',
            'task_id': task.id,
            'mode': mode
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
    """Get status of WMM calculation task"""
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
            session['wmm_results'] = result
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
    """Show interactive map for grid/line selection"""
    try:
        # Create a Folium map centered on UK
        m = folium.Map(
            location=[54.5, -4.0],
            zoom_start=6,
            tiles='OpenStreetMap'
        )

        # Add Draw plugin for rectangle and polyline drawing
        draw = Draw(
            export=False,
            draw_options={
                'polyline': {'allowIntersection': False},
                'polygon': False,
                'circle': False,
                'marker': False,
                'circlemarker': False,
                'rectangle': {'showArea': True}
            }
        )
        draw.add_to(m)

        # Add JavaScript to capture drawn shapes
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

            var data = null;

            if (type === 'rectangle') {
                var bounds = layer.getBounds();
                data = {
                    type: 'rectangle',
                    bounds: {
                        north: bounds.getNorth(),
                        south: bounds.getSouth(),
                        east: bounds.getEast(),
                        west: bounds.getWest()
                    }
                };
            } else if (type === 'polyline') {
                var latlngs = layer.getLatLngs();
                data = {
                    type: 'polyline',
                    coords: latlngs.map(function(ll) {
                        return [ll.lng, ll.lat];
                    })
                };
            }

            // Send to parent window
            if (window.parent && data) {
                window.parent.postMessage({
                    type: 'shape_drawn',
                    shape: data
                }, '*');
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
    """Export WMM calculation results as CSV"""
    try:
        if 'wmm_results' not in session:
            return jsonify({'status': 'error', 'message': 'No data to export. Run calculation first.'}), 400

        results = session['wmm_results']

        if results.get('status') != 'success':
            return jsonify({'status': 'error', 'message': 'No valid results to export'}), 400

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)

        # Check if it's grid or line results
        if 'plots' in results and 'total_intensity' in results.get('plots', {}):
            # Grid mode - export statistics
            stats = results.get('statistics', {})
            writer.writerow(['WMM Grid Calculation Results'])
            writer.writerow(['Total Points', stats.get('total_points', 0)])
            writer.writerow(['F Max (nT)', stats.get('f_max', 0)])
            writer.writerow(['F Min (nT)', stats.get('f_min', 0)])
            writer.writerow(['F Mean (nT)', stats.get('f_mean', 0)])
        elif 'results' in results:
            # Line mode - export all points
            writer.writerow(['Longitude', 'Latitude', 'F (nT)', 'H (nT)', 'X (nT)', 'Y (nT)', 'Z (nT)', 'D (°)', 'I (°)'])
            for point in results['results']:
                writer.writerow([
                    point['lon'], point['lat'],
                    point['f'], point['h'],
                    point['x'], point['y'], point['z'],
                    point['d'], point['i']
                ])

        # Create response
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name='wmm_geomagnetic_data.csv'
        )

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
