// =====================
// 使用者系統 (純前端)
// =====================
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authForms = document.getElementById('authForms');
const welcome = document.getElementById('welcome');
const welcomeText = document.getElementById('welcomeText');
const uploadSection = document.getElementById('upload');

let currentUser = localStorage.getItem('currentUser') || null;

// 更新畫面顯示狀態
function updateUI() {
    if(currentUser){
        authForms.style.display = 'none';
        welcome.style.display = 'block';
        welcomeText.textContent = `歡迎, ${currentUser}`;
        uploadSection.style.display = 'block';
    } else {
        authForms.style.display = 'block';
        welcome.style.display = 'none';
        uploadSection.style.display = 'none';
    }
}
updateUI();

// 註冊帳號
registerBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if(!username || !password){
        alert('帳號密碼不可為空');
        return;
    }
    let users = JSON.parse(localStorage.getItem('users') || '{}');
    if(users[username]){
        alert('帳號已存在');
        return;
    }
    users[username] = btoa(password); // 簡單存密碼
    localStorage.setItem('users', JSON.stringify(users));
    alert('註冊成功');
});

// 登入帳號
loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    let users = JSON.parse(localStorage.getItem('users') || '{}');
    if(users[username] && atob(users[username]) === password){
        currentUser = username;
        localStorage.setItem('currentUser', currentUser);
        updateUI();
    } else {
        alert('帳號或密碼錯誤');
    }
});

// 登出
logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUI();
});

// =====================
// Leaflet 地圖
// =====================
var map = L.map('mapid').setView([25.033, 121.565], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// =====================
// 上傳剩食功能
// =====================
const form = document.getElementById('foodForm');
const foodList = document.getElementById('foodList');
const featuredList = document.getElementById('featuredList');

form.addEventListener('submit', function(e){
    e.preventDefault();

    // 確認使用者已登入
    if(!currentUser){
        alert('請先登入才能上傳剩食');
        return;
    }

    const name = document.getElementById('foodName').value;
    const loc = document.getElementById('foodLocation').value;
    const fileInput = document.getElementById('foodImage');
    const file = fileInput.files[0];

    // ----- 推薦區塊 -----
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item';
    const itemText = document.createElement('p');
    itemText.textContent = name;
    itemDiv.appendChild(itemText);
    if(file){
        const itemImg = document.createElement('img');
        itemImg.src = URL.createObjectURL(file);
        itemImg.style.width = '100px';
        itemImg.style.height = '100px';
        itemImg.style.objectFit = 'cover';
        itemDiv.appendChild(itemImg);
    }
    featuredList.appendChild(itemDiv);

    // ----- 顯示文字區塊 -----
    const div = document.createElement('div');
    div.style.marginTop = '10px';
    const text = document.createElement('p');
    text.textContent = `食物: ${name} / 地點: ${loc}`;
    div.appendChild(text);
    if(file){
        const img = document.createElement('img');
        img.style.width = '200px';
        img.style.height = '150px';
        img.style.objectFit = 'cover';
        img.style.marginTop = '5px';
        img.src = URL.createObjectURL(file);
        div.appendChild(img);
    }
    foodList.appendChild(div);

    // ----- 地圖新增標記 -----
    L.marker([25.033 + Math.random()/100, 121.565 + Math.random()/100])
     .addTo(map)
     .bindPopup(`<b>${name}</b><br>${loc}`);

    form.reset();
});
