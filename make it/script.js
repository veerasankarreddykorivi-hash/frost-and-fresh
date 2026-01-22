// --- FIREBASE CONFIGURATION ---
// IMPORTANT: Paste your actual Firebase Config here from the Firebase Console!
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
}

// --- APP STATE ---
let state = {
    cart: [],
    user: null, // { phone: '', uid: '' }
    selectedPayment: null,
    confirmationResult: null // For Firebase OTP
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    updateCartIcon();

    // Setup Firebase Recaptcha
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible'
        });
    }
});

// --- UI HELPERS ---
function toggleModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.toggle('active');
}

function toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    drawer.classList.toggle('active');
}

// --- PRODUCT CARD LOGIC ---
function updateLocalQty(id, delta) {
    const el = document.getElementById(id);
    let val = parseInt(el.innerText);
    val += delta;
    if (val < 1) val = 1;
    el.innerText = val;
}

function limitCheckboxes(name, max) {
    const boxes = document.querySelectorAll(`input[name="${name}"]`);
    const checked = document.querySelectorAll(`input[name="${name}"]:checked`);

    if (checked.length >= max) {
        boxes.forEach(box => {
            if (!box.checked) box.disabled = true;
        });
    } else {
        boxes.forEach(box => box.disabled = false);
    }
}

// --- CART LOGIC ---
function addToCart(name, price, optionName, qtyId, isRadio = false) {
    const qty = parseInt(document.getElementById(qtyId).innerText);
    let options = [];

    if (Array.isArray(optionName)) {
        optionName.forEach(n => {
            const sels = document.querySelectorAll(`input[name="${n}"]:checked`);
            sels.forEach(s => options.push(s.value));
        });
    } else {
        const type = isRadio ? ':checked' : ':checked';
        const sels = document.querySelectorAll(`input[name="${optionName}"]${type}`);
        sels.forEach(s => options.push(s.value));
    }

    if (options.length === 0) {
        alert("Please select at least one option/flavor!");
        return;
    }

    const item = {
        name,
        price,
        qty,
        options: options.join(", "),
        id: Date.now()
    };

    state.cart.push(item);
    renderCart();
    updateCartIcon();

    const btn = event.currentTarget;
    const oldText = btn.innerText;
    btn.innerText = "✓ Added!";
    btn.style.background = "#25D366";
    setTimeout(() => {
        btn.innerText = oldText;
        btn.style.background = "";
    }, 1500);
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total');

    container.innerHTML = '';
    let total = 0;

    state.cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item-ui';
        div.innerHTML = `
            <div>
                <h4 style="margin:0">${item.name} x${item.qty}</h4>
                <small style="color:#888">${item.options}</small>
            </div>
            <div style="text-align:right">
                <p style="margin:0; font-weight:600">₹${itemTotal}</p>
                <button onclick="removeFromCart(${item.id})" style="border:none; background:none; color:red; cursor:pointer; font-size:0.7rem;">Remove</button>
            </div>
        `;
        container.appendChild(div);
    });

    totalEl.innerText = `₹${total}`;
}

function removeFromCart(id) {
    state.cart = state.cart.filter(i => i.id !== id);
    renderCart();
    updateCartIcon();
}

function updateCartIcon() {
    const count = state.cart.reduce((acc, i) => acc + i.qty, 0);
    const badge = document.querySelector('.cart-count');
    if (badge) badge.innerText = count;
}

// --- REAL-TIME AUTH (FIREBASE) ---
function simulationLogin() {
    const phone = document.getElementById('login-phone').value;
    if (phone.length < 10) {
        alert("Please enter a valid 10-digit phone number (e.g. +91...)");
        return;
    }

    const fullPhone = phone.startsWith('+') ? phone : '+91' + phone;

    // Logic: If Firebase is not configured, fallback to simulation
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        alert("Firebase not configured. Using SIMULATION mode. OTP is 1234");
        document.getElementById('otp-section').classList.remove('hidden');
        return;
    }

    firebase.auth().signInWithPhoneNumber(fullPhone, window.recaptchaVerifier)
        .then((confirmationResult) => {
            state.confirmationResult = confirmationResult;
            document.getElementById('otp-section').classList.remove('hidden');
            alert("OTP sent to " + fullPhone);
        }).catch((error) => {
            alert("Error: " + error.message);
        });
}

function verifyOTP() {
    const otp = document.getElementById('login-otp').value;

    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        if (otp === "1234") {
            completeLogin({ phoneNumber: document.getElementById('login-phone').value });
        } else {
            alert("Invalid Simulation OTP! Use 1234");
        }
        return;
    }

    state.confirmationResult.confirm(otp)
        .then((result) => {
            completeLogin(result.user);
        }).catch((error) => {
            alert("Invalid OTP: " + error.message);
        });
}

function completeLogin(user) {
    state.user = { phone: user.phoneNumber, loggedIn: true };
    document.getElementById('user-display').innerText = "Account (" + state.user.phone.slice(-4) + ")";
    toggleModal('login-modal');
    alert("Logged in as " + state.user.phone);
}

// --- REAL-TIME LOCATION (GEOLOCATION API) ---
function simulateLocation() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    const btn = event.target;
    btn.innerText = "📍 Locating...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Reverse Geocoding via OpenStreetMap (Free, no key required)
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
                .then(res => res.json())
                .then(data => {
                    document.getElementById('address').value = data.display_name;
                    btn.innerText = "📍 Location Found";
                })
                .catch(err => {
                    document.getElementById('address').value = `Latitude: ${lat}, Longitude: ${lon}`;
                    btn.innerText = "📍 Coords Found";
                });
        },
        (error) => {
            alert("Error finding location: " + error.message);
            btn.innerText = "📍 Use Current Location";
        }
    );
}

// --- CHECKOUT & WHATSAPP ---
function selectPayment(mode) {
    state.selectedPayment = mode;
    document.querySelectorAll('.pay-option').forEach(btn => btn.classList.remove('selected'));
    const target = event.target.closest('.pay-option') || event.target;
    target.classList.add('selected');
}

function generateOrderMessage() {
    let msg = `*NEW ORDER - Frost & Fresh*\n--------------------------\n`;

    state.cart.forEach((item, idx) => {
        msg += `${idx + 1}. *${item.name}* (x${item.qty})\n`;
        msg += `   Options: ${item.options}\n`;
        msg += `   Price: ₹${item.price * item.qty}\n\n`;
    });

    msg += `--------------------------\n`;
    msg += `*Total Amount:* ₹${state.cart.reduce((acc, i) => acc + (i.price * i.qty), 0)}\n`;
    msg += `*Payment Method:* ${state.selectedPayment}\n`;
    msg += `*Delivery Address:* ${document.getElementById('address').value}\n`;
    msg += `*Customer Phone:* ${state.user ? state.user.phone : 'N/A'}\n`;

    return encodeURIComponent(msg);
}

function placeOrder() {
    if (!state.user || !state.user.loggedIn) {
        alert("Please login first!");
        toggleModal('checkout-modal');
        toggleModal('login-modal');
        return;
    }

    if (state.cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    const addr = document.getElementById('address').value;
    if (addr.length < 10) {
        alert("Please enter a valid delivery address or use 'Locate' button.");
        return;
    }

    if (!state.selectedPayment) {
        alert("Please select a payment method!");
        return;
    }

    const btn = document.getElementById('finish-order-btn');
    btn.innerText = "Redirecting to WhatsApp...";
    btn.disabled = true;

    setTimeout(() => {
        const waLink = `https://wa.me/919876543210?text=${generateOrderMessage()}`;
        window.open(waLink, '_blank');

        toggleModal('checkout-modal');
        toggleModal('success-modal');

        // Reset App State for safety
        state.cart = [];
        updateCartIcon();
        renderCart();
    }, 1500);
}
