
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lykatdkwgukjgiaudgat.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
// ===== 元素選取 =====
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const welcomeText = document.getElementById('welcomeText');
const uploadSection = document.getElementById('upload');
const foodForm = document.getElementById('foodForm');
const foodList = document.getElementById('foodList');
const featuredList = document.getElementById('featuredList');
const useMyLocationBtn = document.getElementById('useMyLocationBtn');

let currentUser = null;
let currentLatLng = null;

// ===== Leaflet 地圖 =====
var map = L.map('mapid').setView([25.033, 121.565], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ===== 登入 / 註冊 =====
registerBtn.addEventListener('click', async ()=>{
    const email = emailInput.value;
    const password = passwordInput.value;
    if(!email||!password){ alert("請填寫完整"); return; }
    const { error } = await supabase.auth.signUp({ email, password });
    if(error){ alert(error.message); } else { alert("註冊成功"); }
});

loginBtn.addEventListener('click', async ()=>{
    const email = emailInput.value;
    const password = passwordInput.value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if(error){ alert(error.message); } 
});

logoutBtn.addEventListener('click', async ()=>{
    await supabase.auth.signOut();
});

// 監聽登入狀態
supabase.auth.onAuthStateChange((_event, session)=>{
    if(session?.user){
        currentUser = session.user;
        uploadSection.style.display = 'block';
        logoutBtn.style.display = 'inline';
        registerBtn.style.display = 'none';
        loginBtn.style.display = 'none';
        welcomeText.textContent = `歡迎, ${currentUser.email}`;
        loadFoods();
    } else {
        currentUser = null;
        uploadSection.style.display = 'none';
        logoutBtn.style.display = 'none';
        registerBtn.style.display = 'inline';
        loginBtn.style.display = 'inline';
        welcomeText.textContent = '';
        foodList.innerHTML = '';
        featuredList.innerHTML = '';
    }
});

// ===== 使用者位置 =====
useMyLocationBtn.addEventListener('click', ()=>{
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
foodForm.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!currentUser){ alert('請先登入'); return; }

    const name = document.getElementById('foodName').value;
    const loc = document.getElementById('foodLocation').value;
    const fileInput = document.getElementById('foodImage');
    let image_url = '';

    if(fileInput.files[0]){
        const file = fileInput.files[0];
        const fileName = Date.now() + "-" + file.name;
        const { data, error } = await supabase.storage.from('food-images').upload(fileName, file);
        if(error){ alert(error.message); return; }

        const { publicUrl } = supabase.storage.from('food-images').getPublicUrl(fileName);
        image_url = publicUrl;
    }

    const { error } = await supabase.from('foods').insert([{
        user_email: currentUser.email,
        name,
        location: loc,
        lat: currentLatLng?.[0] || null,
        lng: currentLatLng?.[1] || null,
        image_url,
        created_at: new Date()
    }]);

    if(error){ alert(error.message); return; }

    foodForm.reset();
    currentLatLng = null;
    loadFoods();
});

// ===== 讀取剩食 =====
async function loadFoods(){
    const { data, error } = await supabase.from('foods').select('*').order('created_at', {ascending:false});
    if(error){ console.log(error); return; }
    foodList.innerHTML = '';
    featuredList.innerHTML = '';
    data.forEach(f => addFoodToPage(f));
}

// ===== 顯示剩食 =====
function addFoodToPage(f){
    // 推薦區
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item';
    const itemText = document.createElement('p');
    itemText.textContent = f.name;
    itemDiv.appendChild(itemText);
    if(f.image_url){
        const itemImg = document.createElement('img');
        itemImg.src = f.image_url;
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
    if(f.image_url){
        const img = document.createElement('img');
        img.src = f.image_url;
        img.style.width = '200px';
        img.style.height = '150px';
        img.style.objectFit = 'cover';
        img.style.marginTop = '5px';
        div.appendChild(img);
    }
    foodList.appendChild(div);

    // 地圖標記
    if(f.lat && f.lng){
        L.marker([f.lat, f.lng])
         .addTo(map)
         .bindPopup(`<b>${f.name}</b><br>${f.location}`);
    }
}
