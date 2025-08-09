import os
import time
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy

# Initialize the Flask app
app = Flask(__name__)

# --- DATABASE CONNECTION WITH RETRY LOGIC ---
retries = 5
delay = 5
while retries > 0:
    try:
        # Configure the database connection from environment variables
        app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        
        # Initialize the database extension
        db = SQLAlchemy(app)

        # A simple query to test the connection
        with app.app_context():
            db.engine.connect()
        
        print("Database connection successful!")
        break # Exit the loop if connection is successful

    except Exception as e:
        print(f"Database connection failed. Retrying in {delay} seconds... ({retries-1} retries left)")
        print(f"Error: {e}")
        retries -= 1
        time.sleep(delay)
        if retries == 0:
            # Exit if we can't connect after all retries
            raise Exception("Could not connect to the database after several retries.")
# --- END OF RETRY LOGIC ---


# Define the User model for our database table
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)

    def to_json(self):
        """Serializes the User object to a JSON-friendly dictionary."""
        return {
            'id': self.id,
            'username': self.username
        }

@app.route('/users', methods=['GET'])
def get_users():
    """Returns the list of all users from the database."""
    try:
        users = User.query.all()
        return jsonify([user.to_json() for user in users])
    except Exception as e:
        app.logger.error(f"Error fetching users: {e}")
        return jsonify({"error": "Could not retrieve users"}), 500
    
@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Returns a single user by their ID."""
    user = User.query.get(user_id)
    if user:
        return jsonify(user.to_json())
    return jsonify({"error": "User not found"}), 404

@app.route('/users/fetch', methods=['POST'])
def fetch_users():
    """Fetches multiple users by their IDs."""
    user_ids = request.get_json().get('user_ids', [])
    if not user_ids:
        return jsonify([])
    
    # Use the 'in_' operator to fetch all users with IDs in the list
    users = User.query.filter(User.id.in_(user_ids)).all()
    return jsonify([user.to_json() for user in users])

@app.route('/users/init', methods=['POST'])
def init_users():
    """Creates initial users in the database."""
    try:
        db.session.query(User).delete()
        user1 = User(id=1, username="Pranav")
        user2 = User(id=2, username="Alex")
        db.session.add_all([user1, user2])
        db.session.commit()
        return jsonify({"message": "Database initialized with users"}), 201
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error initializing users: {e}")
        return jsonify({"error": "Could not initialize users"}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5001)