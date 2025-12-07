// ===== Firebase 設定 =====
// TODO: 把下面改成你的 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDCnxi5yYqPMSnEojPfnXgqBE2_Oi-X1OY",
  authDomain: "freedge-yzu.firebaseapp.com",
  projectId: "freedge-yzu",
  storageBucket: "freedge-yzu.firebasestorage.app",
  messagingSenderId: "577649251490",
  appId: "1:577649251490:web:9fb4af3ee7c4d9d06f33fb",
  measurementId: "G-GVK312YLPL"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// ===== 元素選取 =====
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authForms = document.getElementById('authForms');
const welcome = document.getElementById('welcome');
const welcomeText = document.getElementById('welcomeText');
const uploadSection = document.getElementById('upload');

const form = document.getElementById('foodForm');
const foodList = document.getElementById('foodList');
const featuredList = document.getElementById('featuredList');
const useMyLocationBtn = document.getElementById('useMyLocationBtn');

let currentLatLng = null;

// ===== 登入/註冊/登出 =====
registerBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if(!email || !password){ alert('請填寫完整'); return; }
    auth.createUserWithEmailAndPassword(email, password)
    .then(() => alert('註冊成功'))
    .catch(err => alert(err.message));
});

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    auth.signInWithEmailAndPassword(email, password)
    .catch(err => alert(err.message));
});

logoutBtn.addEventListener('click', () => { auth.signOut(); });

// 監聽登入狀態
auth.onAuthStateChanged(user => {
    if(user){
        currentUser = user;
        authForms.style.display = 'none';
        welcome.style.display = 'block';
        welcomeText.textContent = `歡迎, ${user.email}`;
        uploadSection.style.display = 'block';
        loadFoods();
    } else {
        currentUser = null;
        authForms.style.display = 'block';
        welcome.style.display = 'none';
        uploadSection.style.display = 'none';
        featuredList.innerHTML = '';
        foodList.innerHTML = '';
    }
});

// ===== Leaflet 地圖 =====
var map = L.map('mapid').setView([25.033, 121.565], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ===== 使用者位置 =====
useMyLocationBtn.addEventListener('click', () => {
    if(!navigator.geolocation){ alert('瀏覽器不支援'); return; }
    navigator.geolocation.getCurrentPosition(
        pos => {
            currentLatLng = [pos.coords.latitude, pos.coords.longitude];
            document.getElementById('foodLocation').value = `經度:${currentLatLng[1].toFixed(5)}, 緯度:${currentLatLng[0].toFixed(5)}`;
        },
        err => alert('無法取得位置')
    );
});

// ===== 上傳剩食 =====
form.addEventListener('submit', e => {
    e.preventDefault();
    if(!currentUser){ alert('請先登入'); return; }

    const name = document.getElementById('foodName').value;
    const loc = document.getElementById('foodLocation').value;
    const fileInput = document.getElementById('foodImage');
    let fileData = '';

    if(fileInput.files[0]){
        fileData = URL.createObjectURL(fileInput.files[0]);
    }

    const foodData = {
        user: currentUser.email,
        name, location: loc,
        latLng: currentLatLng,
        image: fileData,
        timestamp: Date.now()
    };

    const newRef = db.ref('foods').push();
    newRef.set(foodData);

    form.reset();
    currentLatLng = null;
});

// ===== 讀取剩食 =====
function loadFoods(){
    db.ref('foods').on('value', snapshot => {
        featuredList.innerHTML = '';
        foodList.innerHTML = '';
        snapshot.forEach(snap => addFoodToPage(snap.val()));
    });
}

// ===== 顯示剩食 =====
function addFoodToPage(f){
    // 推薦區
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item';
    const itemText = document.createElement('p');
    itemText.textContent = f.name;
    itemDiv.appendChild(itemText);
    if(f.image){
        const itemImg = document.createElement('img');
        itemImg.src = f.image;
        itemImg.style.width = '100px';
        itemImg.style.height = '100px';
        itemImg.style.objectFit = 'cover';
        itemDiv.appendChild(itemImg);
    }
    featuredList.appendChild(itemDiv);

    // 列表區
    const div = document.createElement('div');
    div.style.marginTop = '10px';
    const text = document.createElement('p');
    text.textContent = `食物: ${f.name} / 地點: ${f.location}`;
    div.appendChild(text);
    if(f.image){
        const img = document.createElement('img');
        img.src = f.image;
        img.style.width = '200px';
        img.style.height = '150px';
        img.style.objectFit = 'cover';
        img.style.marginTop = '5px';
        div.appendChild(img);
    }
    foodList.appendChild(div);

    // 地圖標記
    let markerLatLng = f.latLng || [25.033 + Math.random()/100, 121.565 + Math.random()/100];
    L.marker(markerLatLng)
     .addTo(map)
     .bindPopup(`<b>${f.name}</b><br>${f.location}`);
}
