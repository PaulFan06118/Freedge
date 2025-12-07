// ====== Firebase 初始化 ======
const firebaseConfig = {
  apiKey: "AIzaSyDCnxi5yYqPMSnEojPfnXgqBE2_Oi-X1OY",
  authDomain: "freedge-yzu.firebaseapp.com",
  databaseURL: "https://freedge-yzu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freedge-yzu",
  storageBucket: "freedge-yzu.firebasestorage.app",
  messagingSenderId: "577649251490",
  appId: "1:577649251490:web:9fb4af3ee7c4d9d06f33fb",
  measurementId: "G-GVK312YLPL"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

let map;
let user = null;

// ====== Google Map 初始化 ======
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 25.0330, lng: 121.5654 },
        zoom: 14
    });

    loadFoodFromDB();
}

// ====== 監聽登入狀態 ======
auth.onAuthStateChanged(u => {
    user = u;
    if (u) {
        document.getElementById("auth-status").innerText = "已登入：" + u.email;
        document.getElementById("logout-btn").style.display = "inline-block";
        document.getElementById("upload-section").style.display = "block";
    } else {
        document.getElementById("auth-status").innerText = "尚未登入";
        document.getElementById("logout-btn").style.display = "none";
        document.getElementById("upload-section").style.display = "none";
    }
});

// ====== 註冊 ======
document.getElementById("signup-btn").onclick = () => {
    const email = email.value;
    const password = password.value;
    auth.createUserWithEmailAndPassword(email, password)
        .catch(err => alert(err.message));
};

// ====== 登入 ======
document.getElementById("login-btn").onclick = () => {
    const emailVal = email.value;
    const passVal = password.value;
    auth.signInWithEmailAndPassword(emailVal, passVal)
        .catch(err => alert(err.message));
};

// ====== 登出 ======
document.getElementById("logout-btn").onclick = () => auth.signOut();

// ====== 上傳剩食 ======
document.getElementById("upload-btn").onclick = () => {
    if (!user) return alert("請先登入！");

    const name = document.getElementById("food-name").value;
    const desc = document.getElementById("food-desc").value;
    const file = document.getElementById("food-image").files[0];

    if (!file) return alert("請選擇照片！");

    // 將圖片轉成 Base64
    const reader = new FileReader();
    reader.onload = () => {
        navigator.geolocation.getCurrentPosition(pos => {
            db.ref("foods").push({
                user: user.uid,
                name: name,
                desc: desc,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                img: reader.result
            });
        });
    };
    reader.readAsDataURL(file);
};

// ====== 地圖載入剩食 ======
function loadFoodFromDB() {
    db.ref("foods").on("value", snapshot => {
        const data = snapshot.val();
        if (!data) return;

        Object.values(data).forEach(item => {
            new google.maps.Marker({
                position: { lat: item.lat, lng: item.lng },
                map,
                title: item.name
            });
        });
    });
}
