// ====== 初始化 Firebase ======
const firebaseConfig = {
    apiKey: "AIzaSyDCnxi5yYqPMSnEojPfnXgqBE2_Oi-X1OY",
    authDomain: "freedge-yzu.firebaseapp.com",
    databaseURL: "https://freedge-yzu-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freedge-yzu",
    appId: "1:577649251490:web:9fb4af3ee7c4d9d06f33fb"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

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

// ====== 使用者登入/登出 ======
registerBtn.addEventListener("click", async () => {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value);
        alert("註冊成功!");
    } catch(e) { alert(e.message); }
});

loginBtn.addEventListener("click", async () => {
    try {
        await auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value);
    } catch(e) { alert(e.message); }
});

logoutBtn.addEventListener("click", () => auth.signOut());

// ====== 監聽登入狀態 ======
auth.onAuthStateChanged(user => {
    if(user){
        welcomeSection.style.display = "block";
        uploadSection.style.display = "block";
        welcomeText.textContent = `歡迎，${user.email}`;
        loadFoods();
    } else {
        welcomeSection.style.display = "none";
        uploadSection.style.display = "none";
        foodListDiv.innerHTML = "";
    }
});

// ====== 上傳剩食資訊 ======
foodForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const foodName = document.getElementById("foodName").value;
    const foodLocation = document.getElementById("foodLocation").value;
    const foodImageFile = document.getElementById("foodImage").files[0];

    if(!foodImageFile) return alert("請選擇圖片!");

    // 上傳到 Catbox
    const formData = new FormData();
    formData.append("reqtype","fileupload");
    formData.append("userhash","");
    formData.append("fileToUpload", foodImageFile);

    const res = await fetch("https://catbox.moe/user/api.php", { method:"POST", body:formData });
    const imageUrl = await res.text();

    // 存到 Firebase
    const newFoodRef = db.ref("foods").push();
    await newFoodRef.set({
        name: foodName,
        location: foodLocation,
        imageUrl: imageUrl,
        owner: auth.currentUser.email,
        claimedBy: null,
        claimedAt: null,
        createdAt: Date.now()
    });

    foodForm.reset();
});

// ====== 載入剩食列表 ======
function loadFoods(){
    const foodsRef = db.ref("foods");
    foodsRef.off(); // 先移除舊監聽
    foodsRef.on("value", snapshot => {
        const data = snapshot.val() || {};
        renderFoodList(data);
    });
}

// ====== 渲染列表 ======
function renderFoodList(data){
    foodListDiv.innerHTML = "";
    const user = auth.currentUser;
    Object.entries(data).forEach(([id, food]) => {
        const div = document.createElement("div");
        div.className = "foodItem";
        div.innerHTML = `
            <h3>${food.name}</h3>
            <p>位置：${food.location}</p>
            <img src="${food.imageUrl}" style="max-width:200px;">
            <p>上傳者：${food.owner}</p>
            ${food.claimedBy ? `<p>已被 ${food.claimedBy} 領取 (${new Date(food.claimedAt).toLocaleString()})</p>` : ""}
        `;

        // 按鈕區域
        const btnDiv = document.createElement("div");

        // 如果還沒領取，其他使用者可以領取
        if(!food.claimedBy && food.owner !== user.email){
            const claimBtn = document.createElement("button");
            claimBtn.textContent = "領取";
            claimBtn.onclick = () => claimFood(id, food);
            btnDiv.appendChild(claimBtn);
        }

        // 如果已被自己領取，顯示確認領取
        if(food.claimedBy === user.email){
            const confirmBtn = document.createElement("button");
            confirmBtn.textContent = "確認領取";
            confirmBtn.onclick = () => confirmFood(id);
            btnDiv.appendChild(confirmBtn);
        }

        // 如果是上傳者，顯示收回按鈕
        if(food.owner === user.email){
            const removeBtn = document.createElement("button");
            removeBtn.textContent = "收回";
            removeBtn.onclick = () => removeFood(id);
            btnDiv.appendChild(removeBtn);
        }

        div.appendChild(btnDiv);
        foodListDiv.appendChild(div);
    });
}

// ====== 領取 ======
function claimFood(id, food){
    const updates = {
        claimedBy: auth.currentUser.email,
        claimedAt: Date.now()
    };
    db.ref(`foods/${id}`).update(updates);
}

// ====== 確認領取 ======
function confirmFood(id){
    db.ref(`foods/${id}`).remove();
}

// ====== 收回 ======
function removeFood(id){
    db.ref(`foods/${id}`).remove();
}
