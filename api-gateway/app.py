import os
import requests
import re # Make sure re is imported
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

USERS_SERVICE_URL = os.environ.get("USERS_SERVICE_URL")
PRODUCTS_SERVICE_URL = os.environ.get("PRODUCTS_SERVICE_URL")
ORDERS_SERVICE_URL = os.environ.get("ORDERS_SERVICE_URL")

@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy(path):
    # --- THIS IS THE CORRECTED ROUTING LOGIC ---
    # Check for the specific user orders path first
    if re.match(r'^users/\d+/orders/?$', path):
        target_url = f"{ORDERS_SERVICE_URL}/{path}"
    elif path.startswith('users'):
        target_url = f"{USERS_SERVICE_URL}/{path}"
    elif path.startswith('products'):
        target_url = f"{PRODUCTS_SERVICE_URL}/{path}"
    elif path.startswith('orders'):
        target_url = f"{ORDERS_SERVICE_URL}/{path}"
    else:
        return jsonify({"error": "Service not found"}), 404
    # --- END OF CORRECTION ---

    try:
        response = requests.request(
            method=request.method,
            url=target_url,
            headers={key: value for (key, value) in request.headers if key != 'Host'},
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False
        )
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for (name, value) in response.raw.headers.items()
                   if name.lower() not in excluded_headers]
        return (response.content, response.status_code, headers)
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error proxying request: {e}")
        return jsonify({"error": "Service unavailable"}), 503

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)