import os
import pika
import json
import uuid
import requests
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
RABBITMQ_URL = os.environ.get('RABBITMQ_URL')
USERS_SERVICE_URL = os.environ.get("USERS_SERVICE_URL")
PRODUCTS_SERVICE_URL = os.environ.get("PRODUCTS_SERVICE_URL")

# --- NEW DATABASE SCHEMA ---
# An Order is now a container for OrderItems
class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade="all, delete-orphan")

# New table to store each item within an order
class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    product_id = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

class InventoryCheckRpcClient(object):
    def __init__(self):
        self.connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_URL))
        self.channel = self.connection.channel()
        result = self.channel.queue_declare(queue='', exclusive=True)
        self.callback_queue = result.method.queue
        self.channel.basic_consume(queue=self.callback_queue, on_message_callback=self.on_response, auto_ack=True)
        self.response = None
        self.corr_id = None
    def on_response(self, ch, method, props, body):
        if self.corr_id == props.correlation_id:
            self.response = body
    def call(self, items):
        self.response = None
        self.corr_id = str(uuid.uuid4())
        self.channel.basic_publish(
            exchange='', routing_key='inventory_check_request',
            properties=pika.BasicProperties(reply_to=self.callback_queue, correlation_id=self.corr_id),
            body=json.dumps({'items': items})
        )
        while self.response is None:
            self.connection.process_data_events(time_limit=10)
        return json.loads(self.response)

def _enrich_orders(orders):
    if not orders: return []
    product_ids = list(set(item.product_id for order in orders for item in order.items))
    user_ids = list(set(order.user_id for order in orders))
    if not product_ids or not user_ids: return []

    try:
        products_response = requests.post(f"{PRODUCTS_SERVICE_URL}/products/fetch", json={'product_ids': product_ids})
        products_data = {product['id']: product for product in products_response.json()}
        users_response = requests.post(f"{USERS_SERVICE_URL}/users/fetch", json={'user_ids': user_ids})
        users_data = {user['id']: user for user in users_response.json()}
    except requests.exceptions.RequestException as e:
        return {"error": "Failed to fetch related data"}

    enriched_orders = []
    for order in orders:
        enriched_items = []
        for item in order.items:
            product_info = products_data.get(item.product_id)
            if product_info:
                enriched_items.append({'product': product_info, 'quantity': item.quantity})
        
        enriched_orders.append({
            'order_id': order.id,
            'user': users_data.get(order.user_id, {'error': 'User not found'}),
            'items': enriched_items
        })
    return enriched_orders

@app.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    user_id = data.get('user_id')
    items = data.get('items')

    if not user_id or not items:
        return jsonify({"error": "User ID and a list of items are required"}), 400

    inventory_rpc = InventoryCheckRpcClient()
    inventory_response = inventory_rpc.call(items)
    
    if inventory_response.get('status') != 'success':
        return jsonify({"error": "Inventory check failed", "details": inventory_response.get('details')}), 400

    new_order = Order(user_id=user_id)
    for item in items:
        order_item = OrderItem(product_id=item['product_id'], quantity=item['quantity'])
        new_order.items.append(order_item)
    
    db.session.add(new_order)
    db.session.commit()

    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_URL))
        channel = connection.channel()
        channel.queue_declare(queue='order_created')
        message = {'order_id': new_order.id, 'items': items}
        channel.basic_publish(exchange='', routing_key='order_created', body=json.dumps(message))
        connection.close()
    except Exception as e:
        app.logger.error(f"Failed to send order_created message: {e}")

    return jsonify({'order_id': new_order.id}), 201

@app.route('/users/<int:user_id>/orders', methods=['GET'])
def get_user_orders(user_id):
    orders = Order.query.filter_by(user_id=user_id).all()
    result = _enrich_orders(orders)
    if "error" in result:
        return jsonify(result), 503
    return jsonify(result)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5003)