import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDdoRkqJQ0Qvp-UXQrcWTru7BBgGL93TV0",
    authDomain: "beba-agua-codoc.firebaseapp.com",
    projectId: "beba-agua-codoc",
    storageBucket: "beba-agua-codoc.firebasestorage.app",
    messagingSenderId: "515828751447",
    appId: "1:515828751447:web:8c71308c16fb136b351712",
    measurementId: "G-0HGVR7W1GV"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null; 
let unsubDashboard = null; 

const getTodayDate = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
};

window.loginComGoogle = async function() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            currentUser = user.uid;
            document.getElementById('menu').classList.remove('hidden');
            window.showScreen('profile-screen');
        } else {
            document.getElementById('login-card').classList.add('hidden');
            document.getElementById('complete-register-card').classList.remove('hidden');
            document.getElementById('welcome-name').innerText = `Bem-vindo, ${user.displayName}! Precisamos de mais alguns dados.`;
        }
    } catch (error) {
        console.error("Erro ao fazer login com Google: ", error);
        alert("Falha ao fazer login com o Google.");
    }
};

window.salvarDadosGoogle = async function() {
    const user = auth.currentUser;
    if (!user) return alert('Faça login primeiro!');

    const weight = document.getElementById('weight').value;
    const height = document.getElementById('height').value;
    const age = document.getElementById('age').value;

    if (!weight || !height || !age) return alert('Preencha todos os campos!');

    const goal = Math.round(weight * 35);
    const userRef = doc(db, "usuarios", user.uid);

    await setDoc(userRef, {
        nome: user.displayName, 
        foto: user.photoURL,
        weight: weight,
        height: height,
        age: age,
        goal: goal,
        totalHoje: 0,
        historico: [],
        dias: {}, // Inicia o histórico de dias zerado
        ultimaAtualizacao: getTodayDate()
    });

    currentUser = user.uid;
    document.getElementById('menu').classList.remove('hidden');
    window.showScreen('profile-screen');
};

window.logout = async function() {
    try {
        await signOut(auth);
        currentUser = null;
        document.getElementById('menu').classList.add('hidden');
        
        document.getElementById('login-card').classList.remove('hidden');
        document.getElementById('complete-register-card').classList.add('hidden');
        
        if(unsubDashboard) {
            unsubDashboard(); 
        }
        
        window.showScreen('auth-screen');
    } catch (error) {
        console.error("Erro ao sair: ", error);
    }
};

window.showScreen = function(screenId) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('profile-screen').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');

    if (screenId === 'profile-screen' && currentUser) carregarPerfil();
    if (screenId === 'dashboard-screen') {
        // Quando abrir o dashboard, o calendário vem com a data de hoje
        document.getElementById('ranking-date').value = getTodayDate();
        carregarDashboard();
    }
};

async function carregarPerfil() {
    const userRef = doc(db, "usuarios", currentUser);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return;
    let dados = userSnap.data();

    if (dados.ultimaAtualizacao !== getTodayDate()) {
        dados.totalHoje = 0;
        dados.historico = [];
    }

    document.getElementById('user-greeting').innerText = `Olá, ${dados.nome}!`;
    document.getElementById('user-goal').innerText = dados.goal;
    document.getElementById('user-current').innerText = dados.totalHoje;

    let percentage = (dados.totalHoje / dados.goal) * 100;
    if (percentage > 100) percentage = 100;
    
    document.getElementById('progress-fill').style.width = percentage + '%';
    document.getElementById('progress-text').innerText = Math.round(percentage) + '% concluído';

    const historyUl = document.getElementById('water-history');
    historyUl.innerHTML = '';
    
    const historicoReverso = [...dados.historico].reverse();
    historicoReverso.forEach(entry => {
        historyUl.innerHTML += `<li>💧 ${entry.amount}ml às ${entry.time}</li>`;
    });
}

window.addSelectedWater = function() {
    const select = document.getElementById('water-amount');
    const amount = parseInt(select.value);
    
    if (amount > 0) {
        window.addWater(amount);
    }
};

window.addWater = async function(amount) {
    if (!currentUser) return;

    const btn = document.querySelector('.add-btn');
    if(btn) {
        btn.disabled = true;
        btn.innerText = "Registrando...";
    }

    const userRef = doc(db, "usuarios", currentUser);
    const userSnap = await getDoc(userRef);
    let dados = userSnap.data();
    
    let novoTotal = dados.totalHoje;
    let novoHistorico = dados.historico || [];
    let dias = dados.dias || {}; // Carrega o histórico de dias

    if (dados.ultimaAtualizacao !== getTodayDate()) {
        novoTotal = 0;
        novoHistorico = [];
    }

    novoTotal += amount;
    
    // Salva o total atual no registro do dia de hoje
    dias[getTodayDate()] = novoTotal;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    novoHistorico.push({ amount: amount, time: timeString });

    await updateDoc(userRef, {
        totalHoje: novoTotal,
        historico: novoHistorico,
        dias: dias,
        ultimaAtualizacao: getTodayDate()
    });

    carregarPerfil();

    if(btn) {
        btn.disabled = false;
        btn.innerText = "Registrar Água 💧";
    }
};

// Nova função acionada sempre que a data no calendário muda
window.mudarDataRanking = function() {
    carregarDashboard();
};

function carregarDashboard() {
    const dataSelecionada = document.getElementById('ranking-date').value || getTodayDate();
    const usuariosRef = collection(db, "usuarios");
    
    if (unsubDashboard) unsubDashboard(); // Limpa o ouvinte anterior
    
    unsubDashboard = onSnapshot(usuariosRef, (snapshot) => {
        const rankingList = document.getElementById('ranking-list');
        rankingList.innerHTML = '';
        let rankingArray = [];

        snapshot.forEach((docSnap) => {
            let dados = docSnap.data();
            let totalExibido = 0;
            
            // Verifica se a data selecionada é hoje
            if (dataSelecionada === getTodayDate()) {
                totalExibido = dados.ultimaAtualizacao === getTodayDate() ? dados.totalHoje : 0;
            } else {
                // Se for outro dia, busca no histórico de dias
                if (dados.dias && dados.dias[dataSelecionada]) {
                    totalExibido = dados.dias[dataSelecionada];
                }
            }

            let percentage = (totalExibido / dados.goal) * 100;

            rankingArray.push({
                nome: dados.nome, 
                total: totalExibido,
                percentage: percentage
            });
        });

        rankingArray.sort((a, b) => b.percentage - a.percentage);
        
        rankingArray.forEach(user => {
            const percArredondado = Math.min(Math.round(user.percentage), 100);
            const goalReached = user.percentage >= 100 ? 'goal-reached' : '';
            const statusIcon = user.percentage >= 100 ? '🏆' : '💧';
            
            rankingList.innerHTML += `
                <div class="ranking-item ${goalReached}">
                    <div>
                        <strong>${user.nome}</strong><br>
                        <small>${percArredondado}% da meta</small>
                    </div>
                    <div>
                        ${user.total} ml ${statusIcon}
                    </div>
                </div>
            `;
        });
    });
}
