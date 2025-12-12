// ====== 初始化 Firebase（請填入你自己的設定） ======
const firebaseConfig = {
    apiKey: "AIzaSyDCnxi5yYqPMSnEojPfnXgqBE2_Oi-X1OY",
    authDomain: "freedge-yzu.firebaseapp.com",
    databaseURL: "https://freedge-yzu-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freedge-yzu",
    appId: "1:577649251490:web:9fb4af3ee7c4d9d06f33fb",
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

// ====== Leaflet 地圖 ======
let map = L.map('mapid').setView([25.0330, 121.5654], 13); // 預設台北
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

// markers 儲存，方便更新/刪除
let markers = {};

// ====== DOM 元素 ======
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const welcomeSection = document.getElementById("welcome");
const uploadSection = document.getElementById("upload");
const welcomeText = document.getElementById("welcomeText");
const foodForm = document.getElementById("foodForm");
const foodListDiv = document.getElementById("foodList");
const useMyLocationBtn = document.getElementById("useMyLocationBtn");
const foodLocationInput = document.getElementById("foodLocation");
const foodImageInput = document.getElementById("foodImage");

// 用來暫存用 GPS 取得的經緯度（若使用者按了「使用我的位置」）
let tempLat = null;
let tempLon = null;

// ====== Auth 操作 ======
registerBtn.addEventListener("click", async () => {
    try {
        await auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value);
        alert("註冊成功！");
    } catch (e) {
        console.error(e);
        alert("註冊失敗：" + e.message);
    }
});

loginBtn.addEventListener("click", async () => {
    try {
        await auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value);
    } catch (e) {
        console.error(e);
        alert("登入失敗：" + e.message);
    }
});

logoutBtn.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(user => {
    if (user) {
        welcomeSection.style.display = "block";
        uploadSection.style.display = "block";
        welcomeText.textContent = `歡迎，${user.email}`;
        loadFoods();
    } else {
        welcomeSection.style.display = "none";
        uploadSection.style.display = "none";
        foodListDiv.innerHTML = "";
        clearAllMarkers();
    }
});

// ====== 取得使用者 GPS ======
useMyLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        return alert("你的瀏覽器不支援地理位置定位。");
    }
    useMyLocationBtn.disabled = true;
    useMyLocationBtn.textContent = "取得中...";
    navigator.geolocation.getCurrentPosition(pos => {
        tempLat = pos.coords.latitude;
        tempLon = pos.coords.longitude;
        useMyLocationBtn.textContent = "已使用我的位置";
        useMyLocationBtn.disabled = false;
        foodLocationInput.value = `我的位置 (lat:${tempLat.toFixed(5)}, lon:${tempLon.toFixed(5)})`;
        // 將地圖移到使用者位置
        map.setView([tempLat, tempLon], 15);
    }, err => {
        console.error(err);
        alert("取得位置失敗: " + (err.message || err.code));
        useMyLocationBtn.disabled = false;
        useMyLocationBtn.textContent = "使用我的位置";
    }, { enableHighAccuracy: true, timeout: 10000 });
});

// ====== 上傳表單處理 ======
foodForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return alert("請先登入。");

    const name = document.getElementById("foodName").value.trim();
    const locationText = foodLocationInput.value.trim();
    const file = foodImageInput.files[0];

    if (!name) return alert("請填寫食物名稱。");
    if (!locationText && tempLat === null) return alert("請填寫位置或使用「使用我的位置」。");
    if (!file) return alert("請選擇圖片。");

    try {
        // 1) 上傳圖片到 Catbox（匿名）
        const formData = new FormData();
        formData.append("reqtype", "fileupload");
        formData.append("userhash", "");
        formData.append("fileToUpload", file);

        const r = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: formData });
        if (!r.ok) throw new Error("圖片上傳失敗，status: " + r.status);
        const imageUrl = (await r.text()).trim();
        console.log("Catbox image url:", imageUrl);

        // 2) 取得經緯度：如果使用者按了 GPS（tempLat/tempLon 不為 null），就用它；否則用 Nominatim 解析地址
        let lat = tempLat;
        let lon = tempLon;
        if (lat === null) {
            // 用 Nominatim geocode
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}`);
            const geoJson = await geoRes.json();
            if (!geoJson || !geoJson.length) {
                return alert("地址無法解析為經緯度，請確認位置文字是否正確。");
            }
            lat = parseFloat(geoJson[0].lat);
            lon = parseFloat(geoJson[0].lon);
        }

        // 3) Push 到 Firebase Realtime Database
        const newRef = db.ref("foods").push();
        await newRef.set({
            name,
            locationText,
            lat,
            lon,
            imageUrl,
            ownerUid: user.uid,
            ownerEmail: user.email || null,
            claimedBy: null,
            claimedAt: null,
            createdAt: Date.now()
        });

        // 清除暫存位置（避免下次誤用）
        tempLat = null;
        tempLon = null;
        useMyLocationBtn.textContent = "使用我的位置";

        foodForm.reset();
        alert("上傳成功！");
    } catch (err) {
        console.error("上傳錯誤", err);
        alert("上傳失敗：" + (err.message || err));
    }
});

// ====== 載入與監聽資料 ======
function loadFoods() {
    const foodsRef = db.ref("foods");
    foodsRef.off();
    foodsRef.on("value", snapshot => {
        const data = snapshot.val() || {};
        renderFoodList(data);
        renderMapMarkers(data);
    }, err => {
        console.error("讀取 foods 失敗:", err);
    });
}

// ====== 清除地圖 markers ======
function clearAllMarkers() {
    for (const k in markers) {
        try { map.removeLayer(markers[k]); } catch(e) {}
    }
    markers = {};
}

// ====== 在地圖上畫 markers ======
function renderMapMarkers(data) {
    clearAllMarkers();
    for (const id in data) {
        const f = data[id];
        // icon 根據是否已被領取調整
        const iconUrl = f.claimedBy ? "https://i.imgur.com/1FH0pPh.png" : "https://i.imgur.com/Hu1QG5H.png";
        const icon = L.icon({ iconUrl, iconSize: [36, 36] });

        // 有些資料若沒 lat/lon 就跳過
        if (typeof f.lat !== "number" && typeof f.lat !== "string") continue;

        const lat = parseFloat(f.lat);
        const lon = parseFloat(f.lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

        const marker = L.marker([lat, lon], { icon }).addTo(map);

        // popup HTML：我們會在 popup 裡放按鈕（按鈕有唯一 id）
        const popupIdClaim = `claim_${id}`;
        const popupIdConfirm = `confirm_${id}`;
        const popupIdRemove = `remove_${id}`;

        let popupHtml = `<div style="min-width:180px">
            <b>${escapeHtml(f.name)}</b><br>
            <img src="${escapeHtml(f.imageUrl)}" width="160" style="display:block;margin:6px 0;"><br>
            <small>上傳者：${escapeHtml(f.ownerEmail || "匿名")}</small><br>
            ${f.claimedBy ? `<small>已被 ${escapeHtml(f.claimedBy)} 領取 (${f.claimedAt ? new Date(f.claimedAt).toLocaleString() : ""})</small><br>` : ""}
            <div style="margin-top:6px;">
        `;

        // 領取按鈕（若未被領取且不是上傳者）
        const currentUser = auth.currentUser;
        if (!f.claimedBy && currentUser && f.ownerUid !== currentUser.uid) {
            popupHtml += `<button id="${popupIdClaim}">領取</button> `;
        }

        // 確認領取（領取人可見）
        if (f.claimedBy && currentUser && f.claimedBy === (currentUser.email || currentUser.uid)) {
            popupHtml += `<button id="${popupIdConfirm}">確認領取</button> `;
        }

        // 收回（上傳者可見）
        if (currentUser && f.ownerUid === currentUser.uid) {
            popupHtml += `<button id="${popupIdRemove}">收回</button>`;
        }

        popupHtml += `</div></div>`;

        marker.bindPopup(popupHtml);

        // 當 popup 開啟時，綁定按鈕事件（因為按鈕是在 popup render 後才在 DOM）
        marker.on('popupopen', () => {
            // 領取按鈕
            const claimBtn = document.getElementById(popupIdClaim);
            if (claimBtn) {
                claimBtn.onclick = async () => {
                    try {
                        await claimFoodTransaction(id);
                        marker.closePopup();
                    } catch (e) {
                        console.error(e);
                        alert("領取失敗：" + e.message);
                    }
                };
            }
            // 確認領取
            const confirmBtn = document.getElementById(popupIdConfirm);
            if (confirmBtn) {
                confirmBtn.onclick = async () => {
                    try {
                        await confirmFood(id);
                        marker.closePopup();
                    } catch (e) {
                        console.error(e);
                        alert("確認領取失敗：" + e.message);
                    }
                };
            }
            // 收回
            const removeBtn = document.getElementById(popupIdRemove);
            if (removeBtn) {
                removeBtn.onclick = async () => {
                    if (!confirm("確定要收回此筆剩食？")) return;
                    try {
                        await removeFood(id);
                        marker.closePopup();
                    } catch (e) {
                        console.error(e);
                        alert("收回失敗：" + e.message);
                    }
                };
            }
        });

        markers[id] = marker;
    }
}

// ====== 在畫面上渲染文字列表（右側或下方） ======
function renderFoodList(data) {
    foodListDiv.innerHTML = "";
    const user = auth.currentUser;
    Object.entries(data).forEach(([id, f]) => {
        const div = document.createElement("div");
        div.className = "foodItem";
        div.style.border = "1px solid #ddd";
        div.style.padding = "8px";
        div.style.margin = "8px 0";

        div.innerHTML = `
            <h4 style="margin:4px 0">${escapeHtml(f.name)}</h4>
            <div>位置：${escapeHtml(f.locationText || "")}</div>
            <div style="margin:6px 0"><img src="${escapeHtml(f.imageUrl)}" style="max-width:160px;"></div>
            <div>上傳者：${escapeHtml(f.ownerEmail || "匿名")}</div>
            ${f.claimedBy ? `<div>已被 ${escapeHtml(f.claimedBy)} 領取 (${f.claimedAt ? new Date(f.claimedAt).toLocaleString() : ""})</div>` : ""}
        `;

        // 按鈕區
        const btnDiv = document.createElement("div");
        btnDiv.style.marginTop = "6px";

        // 領取（未被領且不是上傳者）
        if (!f.claimedBy && user && f.ownerUid !== user.uid) {
            const b = document.createElement("button");
            b.textContent = "領取";
            b.onclick = async () => {
                try {
                    await claimFoodTransaction(id);
                } catch (e) {
                    console.error(e);
                    alert("領取失敗：" + e.message);
                }
            };
            btnDiv.appendChild(b);
        }

        // 確認領取（被自己領取）
        if (f.claimedBy && user && f.claimedBy === (user.email || user.uid)) {
            const b = document.createElement("button");
            b.textContent = "確認領取";
            b.onclick = async () => {
                try {
                    await confirmFood(id);
                } catch (e) {
                    console.error(e);
                    alert("確認失敗：" + e.message);
                }
            };
            btnDiv.appendChild(b);
        }

        // 收回（上傳者）
        if (user && f.ownerUid === user.uid) {
            const b = document.createElement("button");
            b.textContent = "收回";
            b.onclick = async () => {
                if (!confirm("確定要收回？")) return;
                try {
                    await removeFood(id);
                } catch (e) {
                    console.error(e);
                    alert("收回失敗：" + e.message);
                }
            };
            btnDiv.appendChild(b);
        }

        div.appendChild(btnDiv);
        foodListDiv.appendChild(div);
    });
}

// ====== 領取（transaction 保護） ======
async function claimFoodTransaction(id) {
    const user = auth.currentUser;
    if (!user) throw new Error("請先登入。");
    const ref = db.ref(`foods/${id}`);
    await ref.transaction(current => {
        if (current === null) {
            // 已被刪除
            return current;
        }
        if (!current.claimedBy) {
            current.claimedBy = user.email || user.uid;
            current.claimedAt = Date.now();
            return current;
        } else {
            // 已被領取，不覆寫
            return;
        }
    }, (err, committed, snapshot) => {
        if (err) console.error("transaction error:", err);
        // committed true 表示有成功改變資料（變成領取）
    });
}

// ====== 確認領取（刪除節點） ======
async function confirmFood(id) {
    await db.ref(`foods/${id}`).remove();
}

// ====== 收回（上傳者刪除） ======
async function removeFood(id) {
    await db.ref(`foods/${id}`).remove();
}

// ====== 小工具：避免 XSS（只做基本 escape） ======
function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
