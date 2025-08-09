// -------------- App.jsx --------------
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --- Reusable Components ---
const Toast = ({ message, type, onHide }) => {
  useEffect(() => {
    const timer = setTimeout(onHide, 3000);
    return () => clearTimeout(timer);
  }, [onHide]);
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  return (
    <div className={`fixed top-5 right-5 ${bgColor} text-white py-3 px-5 rounded-xl shadow-lg transform transition-all duration-300 ease-in-out animate-slide-in`}>
      {message}
    </div>
  );
};

// UPDATED: Now accepts and displays the quantity of this item in the cart
const ProductCard = ({ product, onAddToCart, cartQuantity }) => {
  const isOutOfStock = product.inventory === 0;
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col transform hover:-translate-y-2 transition-transform duration-300 ease-in-out group relative">
      {/* NEW: Cart quantity badge */}
      {cartQuantity > 0 && (
        <div className="absolute top-4 right-4 bg-indigo-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center z-10">
          {cartQuantity}
        </div>
      )}
      <div className="bg-gray-200 h-48 flex items-center justify-center overflow-hidden">
         <img src={`https://placehold.co/400x300/e2e8f0/334155?text=${product.name.replace(' ', '+')}`} alt={product.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ease-in-out"/>
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h2 className="text-2xl font-bold text-gray-800">{product.name}</h2>
        <p className="text-xl text-gray-700 my-2">₹{product.price.toFixed(2)}</p>
        <p className={`text-sm font-semibold ${isOutOfStock ? 'text-red-600' : 'text-green-600'}`}>
          {isOutOfStock ? 'Out of stock' : `${product.inventory} in stock`}
        </p>
        <div className="mt-auto pt-4">
          <button
            onClick={() => onAddToCart(product)}
            disabled={isOutOfStock}
            className="w-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 ease-in-out disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transform hover:scale-105 disabled:transform-none shadow-md hover:shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.922.778h9.246a1 1 0 00.922-.778L16.78 3H17a1 1 0 000-2H3zM6.31 7l1.12 4.462A1 1 0 008.348 12h4.304a1 1 0 00.918-.538L14.69 7H6.31z" /><path fillRule="evenodd" d="M5 13a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" /></svg>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

// UPDATED: Now gets the cart to pass down quantities
const ProductGrid = ({ products, onAddToCart, cart }) => (
  <div>
    <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">Products</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {products.map(product => {
        const itemInCart = cart.find(item => item.id === product.id);
        const cartQuantity = itemInCart ? itemInCart.quantity : 0;
        return <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} cartQuantity={cartQuantity} />
      })}
    </div>
  </div>
);

const OrderCard = ({ order }) => (
  <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-indigo-500 flex flex-col justify-between h-full">
    <div>
      <p className="font-bold text-lg text-gray-800">Order #{order.order_id}</p>
      <div className="mt-2 space-y-1">
        {order.items.map(item => (
          <p key={item.product.id} className="text-sm text-gray-600">
            {item.quantity}x <span className="font-medium">{item.product.name}</span>
          </p>
        ))}
      </div>
    </div>
    <p className="font-semibold text-2xl text-gray-900 mt-4">
      Total: ₹{order.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2)}
    </p>
  </div>
);
const OrderList = ({ orders, selectedUserName }) => (
  <div>
    <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">{`Orders for ${selectedUserName}`}</h2>
    {orders.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map(order => <OrderCard key={order.order_id} order={order} />)}
      </div>
    ) : (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm"><p className="text-gray-500">No orders found for this user.</p></div>
    )}
  </div>
);
const CartView = ({ cart, onUpdateQuantity, onRemoveItem, onCheckout }) => {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">Your Cart</h2>
            {cart.length > 0 ? (
                <div className="bg-white rounded-xl shadow-md">
                    <ul className="divide-y divide-gray-200">
                        {cart.map(item => (
                            <li key={item.id} className="p-4 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-sm text-gray-500">@ ₹{item.price.toFixed(2)} each</p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="text-gray-500 hover:text-gray-700 p-1 rounded-full bg-gray-100 hover:bg-gray-200">-</button>
                                    <span className="font-medium w-8 text-center">{item.quantity}</span>
                                    <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="text-gray-500 hover:text-gray-700 p-1 rounded-full bg-gray-100 hover:bg-gray-200">+</button>
                                    <button onClick={() => onRemoveItem(item.id)} className="text-red-500 hover:text-red-700 ml-4">Remove</button>
                                </div>
                                <p className="font-medium w-24 text-right">₹{(item.price * item.quantity).toFixed(2)}</p>
                            </li>
                        ))}
                    </ul>
                    <div className="p-4 bg-gray-50 rounded-b-xl flex justify-between items-center">
                        <p className="text-xl font-bold">Total: ₹{total.toFixed(2)}</p>
                        <button onClick={onCheckout} className="bg-green-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                            Checkout
                        </button>
                    </div>
                </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm"><p className="text-gray-500">Your cart is empty.</p></div>
            )}
        </div>
    );
};

// --- Main App Component ---
function App() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [view, setView] = useState('products');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '', visible: false });
  const [cart, setCart] = useState([]);

  const API_GATEWAY_URL = 'http://localhost:5000/api';

  const showToast = (message, type = 'success') => {
    setToast({ message, type, visible: true });
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [productsResponse, usersResponse] = await Promise.all([axios.get(`${API_GATEWAY_URL}/products`), axios.get(`${API_GATEWAY_URL}/users`)]);
      setProducts(productsResponse.data);
      setUsers(usersResponse.data);
      if (usersResponse.data.length > 0) { setSelectedUser(usersResponse.data[0].id); }
      setError(null);
    } catch (err) {
      setError('Failed to load data. Have you seeded the database?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  const handleViewOrders = async () => {
    if (!selectedUser) { showToast('Please select a user.', 'error'); return; }
    try {
      setLoading(true);
      const ordersResponse = await axios.get(`${API_GATEWAY_URL}/users/${selectedUser}/orders`);
      setOrders(ordersResponse.data);
      setView('orders');
      setError(null);
    } catch (err) {
      setError('Failed to load orders for this user.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    const productInStock = products.find(p => p.id === product.id);
    const itemInCart = cart.find(item => item.id === product.id);
    const currentCartQty = itemInCart ? itemInCart.quantity : 0;

    if (currentCartQty >= productInStock.inventory) {
        showToast(`Cannot add more ${product.name}, only ${productInStock.inventory} in stock.`, 'error');
        return;
    }

    setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id === product.id);
        if (existingItem) {
            return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
        }
        return [...prevCart, { ...product, quantity: 1 }];
    });
    
    showToast(`${product.name} added to cart!`);
  };
  
  const handleUpdateQuantity = (productId, newQuantity) => {
    const itemInCart = cart.find(item => item.id === productId);
    if (!itemInCart) return;

    if (newQuantity <= 0) {
        handleRemoveItem(productId);
        return;
    }
    const productInStock = products.find(p => p.id === productId);
    const totalAvailable = productInStock.inventory + itemInCart.quantity; // This logic is now simpler as we don't live-update the main list
    if (newQuantity > totalAvailable) {
        showToast(`Only ${totalAvailable} of ${productInStock.name} in stock.`, 'error');
        return;
    }
    setCart(prevCart => prevCart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  };

  const handleRemoveItem = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
    showToast('Item removed from cart.');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { showToast('Your cart is empty.', 'error'); return; }
    if (!selectedUser) { showToast('Please select a user.', 'error'); return; }

    const orderItems = cart.map(item => ({ product_id: item.id, quantity: item.quantity }));
    try {
        await axios.post(`${API_GATEWAY_URL}/orders`, { user_id: selectedUser, items: orderItems });
        showToast('Checkout successful! Order placed.', 'success');
        setCart([]);
        fetchInitialData();
    } catch (err) {
        const errorMessage = err.response?.data?.details ? JSON.stringify(err.response.data.details) : 'Checkout failed.';
        showToast(errorMessage, 'error');
        fetchInitialData();
    }
  };

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    setError(null);
    try {
      await axios.post(`${API_GATEWAY_URL}/users/init`);
      await axios.post(`${API_GATEWAY_URL}/products/init`);
      showToast('Database seeded successfully!');
      await fetchInitialData();
      setView('products');
      setOrders([]);
      setCart([]);
    } catch (err) {
      setError('Failed to seed the database.');
    } finally {
      setIsSeeding(false);
    }
  };

  const selectedUserName = users.find(u => u.id === selectedUser)?.username;

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      {toast.visible && (<Toast message={toast.message} type={toast.type} onHide={() => setToast({ ...toast, visible: false })} />)}
      <div className="container mx-auto px-4">
        <header className="py-6">
            <div className="bg-white rounded-xl shadow-md p-6 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-500">Micro-Merch</h1>
                    <p className="text-lg text-gray-600 mt-1">The most reliable microservice-powered store.</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div>
                        <label htmlFor="user-select" className="text-sm font-medium text-gray-700 mr-2">Ordering as:</label>
                        <select id="user-select" value={selectedUser} onChange={(e) => setSelectedUser(parseInt(e.target.value))} className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                            {users.map(user => (<option key={user.id} value={user.id}>{user.username}</option>))}
                        </select>
                    </div>
                    <button onClick={() => setView('cart')} className="flex items-center justify-center bg-yellow-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-yellow-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.922.778h9.246a1 1 0 00.922-.778L16.78 3H17a1 1 0 000-2H3zM6.31 7l1.12 4.462A1 1 0 008.348 12h4.304a1 1 0 00.918-.538L14.69 7H6.31z" /><path fillRule="evenodd" d="M5 13a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" /></svg>
                        Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
                    </button>
                    <button onClick={() => (view === 'products' ? handleViewOrders() : setView('products'))} className="flex items-center justify-center bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                        {view === 'products' ? 'View Orders' : 'View Products'}
                    </button>
                    <button onClick={handleSeedDatabase} disabled={isSeeding} className="flex items-center justify-center bg-gray-700 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400">
                        {isSeeding ? 'Seeding...' : 'Seed DB'}
                    </button>
                </div>
            </div>
        </header>
        <main className="py-8">
          {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert"><p>{error}</p></div>}
          {loading ? (<p className="text-gray-500 text-center">Loading...</p>) : (
            view === 'products' ? <ProductGrid products={products} onAddToCart={handleAddToCart} cart={cart} /> :
            view === 'orders' ? <OrderList orders={orders} selectedUserName={selectedUserName} /> :
            <CartView cart={cart} onUpdateQuantity={handleUpdateQuantity} onRemoveItem={handleRemoveItem} onCheckout={handleCheckout} />
          )}
        </main>
        <footer className="text-center py-10 text-gray-500 text-sm mt-12"><p>&copy; 2025 E-commerce MVP. All rights reserved.</p></footer>
      </div>
    </div>
  );
}

export default App;
