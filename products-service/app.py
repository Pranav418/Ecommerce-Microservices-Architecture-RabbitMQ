import os
import pika
import json
import threading
import time
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
RABBITMQ_URL = os.environ.get('RABBITMQ_URL', 'localhost')

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    inventory = db.Column(db.Integer, nullable=False, default=0)
    def to_json(self):
        return {'id': self.id, 'name': self.name, 'price': self.price, 'inventory': self.inventory}

def order_created_callback(ch, method, properties, body):
    with app.app_context():
        message = json.loads(body)
        items = message.get('items', [])
        try:
            for item in items:
                product = Product.query.get(item['product_id'])
                if product and product.inventory >= item['quantity']:
                    product.inventory -= item['quantity']
            db.session.commit()
            print(f"--> [Products Service] Inventory updated for order {message.get('order_id')}")
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating inventory for order: {e}")
    ch.basic_ack(delivery_tag=method.delivery_tag)

def on_inventory_check_request(ch, method, props, body):
    with app.app_context():
        message = json.loads(body)
        items = message.get('items', [])
        response = {'status': 'success', 'details': {}}
        for item in items:
            product = Product.query.get(item['product_id'])
            if not product or product.inventory < item['quantity']:
                response['status'] = 'fail'
                response['details'][str(item['product_id'])] = f"Not enough stock for {product.name if product else 'Unknown Product'}"
        ch.basic_publish(exchange='',
                         routing_key=props.reply_to,
                         properties=pika.BasicProperties(correlation_id=props.correlation_id),
                         body=json.dumps(response))
        ch.basic_ack(delivery_tag=method.delivery_tag)
    print(f"--> [Products Service] Replied to inventory check request: {response['status']}")

def start_consumer():
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_URL))
            channel = connection.channel()
            channel.queue_declare(queue='order_created')
            channel.queue_declare(queue='inventory_check_request')
            channel.basic_consume(queue='order_created', on_message_callback=order_created_callback)
            channel.basic_consume(queue='inventory_check_request', on_message_callback=on_inventory_check_request)
            print("RabbitMQ consumers are waiting for messages.")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError as e:
            app.logger.error(f"RabbitMQ connection failed: {e}. Retrying...")
            time.sleep(5)

@app.route('/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([product.to_json() for product in products])

@app.route('/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get(product_id)
    if product:
        return jsonify(product.to_json())
    return jsonify({"error": "Product not found"}), 404

@app.route('/products/fetch', methods=['POST'])
def fetch_products():
    product_ids = request.get_json().get('product_ids', [])
    if not product_ids: return jsonify([])
    products = Product.query.filter(Product.id.in_(product_ids)).all()
    return jsonify([product.to_json() for product in products])

@app.route('/products/init', methods=['POST'])
def init_products():
    db.session.query(Product).delete()
    db.session.commit()
    product1 = Product(id=101, name="Laptop Pro", price=1200, inventory=10)
    product2 = Product(id=102, name="Wireless Mouse", price=25, inventory=50)
    product3 = Product(id=103, name="Mechanical Keyboard", price=150, inventory=20)
    product4 = Product(id=104, name="4K Monitor", price=450, inventory=15)
    product5 = Product(id=105, name="Webcam HD", price=80, inventory=30)
    product6 = Product(id=106, name="USB-C Hub", price=45, inventory=0)
    db.session.add_all([product1, product2, product3, product4, product5, product6])
    db.session.commit()
    return jsonify({"message": "Database initialized with more products"}), 201

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    consumer_thread = threading.Thread(target=start_consumer, daemon=True)
    consumer_thread.start()
    app.run(host='0.0.0.0', port=5002)