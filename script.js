import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
let dadosGlobais = []; 

const getTodayDate = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
};

const getCurrentMonth = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('-').slice(0, 2).join('-');
};

// Monitorar o estado de autenticação (Manter o usuário logado ao atualizar)
onAuthStateChanged(auth, async (user) => {
    if (user) {
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
            window.showScreen('auth-screen');
        }
    } else {
        currentUser = null;
        document.getElementById('menu').classList.add('hidden');
        document.getElementById('login-card').classList.remove('hidden');
        document.getElementById('complete-register-card').classList.add('hidden');
        window.showScreen('auth-screen');
    }
});

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
        dias: {}, 
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
    document.getElementById('monthly-ranking-screen').classList.add('hidden');
    document.getElementById('profile-screen').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');

    if (screenId === 'profile-screen' && currentUser) carregarPerfil();
    
    if (screenId === 'dashboard-screen' || screenId === 'monthly-ranking-screen') {
        if (screenId === 'dashboard-screen') {
            document.getElementById('ranking-date').value = getTodayDate();
        }
        if (screenId === 'monthly-ranking-screen') {
            document.getElementById('monthly-date').value = getCurrentMonth();
        }
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
    let dias = dados.dias || {};

    if (dados.ultimaAtualizacao !== getTodayDate()) {
        novoTotal = 0;
        novoHistorico = [];
    }

    novoTotal += amount;
    
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

window.renderizarRanking = function() {
    const dataSelecionada = document.getElementById('ranking-date').value || getTodayDate();
    const hoje = getTodayDate();
    const subtitle = document.getElementById('dashboard-subtitle');
    
    if (dataSelecionada === hoje) {
        subtitle.innerText = "Atualizado em tempo real";
    } else {
        const partes = dataSelecionada.split('-');
        if (partes.length === 3) {
            subtitle.innerText = `Histórico do dia ${partes[2]}/${partes[1]}/${partes[0]}`;
        }
    }
    
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    let rankingArray = [];

    dadosGlobais.forEach((dados) => {
        let totalExibido = 0;
        
        if (dataSelecionada === hoje) {
            totalExibido = dados.ultimaAtualizacao === hoje ? dados.totalHoje : 0;
        } else {
            if (dados.dias && dados.dias[dataSelecionada] !== undefined) {
                totalExibido = dados.dias[dataSelecionada];
            } else {
                totalExibido = 0; 
            }
        }

        let percentage = (dados.goal > 0) ? (totalExibido / dados.goal) * 100 : 0;

        rankingArray.push({
            nome: dados.nome || "Usuário", 
            total: totalExibido,
            percentage: percentage
        });
    });

    rankingArray.sort((a, b) => b.percentage - a.percentage);
    
    rankingArray.forEach(user => {
        const percArredondado = Math.min(Math.round(user.percentage), 100);
        const goalReached = user.percentage >= 100 ? 'goal-reached' : '';
        
        let displayStatus = user.percentage >= 100 ? 'Meta atingida 🏆' : `${percArredondado}% da meta`;
        
        rankingList.innerHTML += `
            <div class="ranking-item ${goalReached}">
                <div>
                    <strong>${user.nome}</strong>
                </div>
                <div style="font-weight: bold; color: ${user.percentage >= 100 ? '#2ecc71' : '#555'};">
                    ${displayStatus}
                </div>
            </div>
        `;
    });
};

window.renderizarRankingMensal = function() {
    const mesSelecionado = document.getElementById('monthly-date').value || getCurrentMonth(); 
    const subtitle = document.getElementById('monthly-subtitle');
    
    const partes = mesSelecionado.split('-');
    if (partes.length === 2) {
        subtitle.innerText = `Metas atingidas em ${partes[1]}/${partes[0]}`;
    }
    
    const rankingList = document.getElementById('monthly-ranking-list');
    rankingList.innerHTML = '';
    let rankingArray = [];

    dadosGlobais.forEach((dados) => {
        let diasAtingidos = 0;
        
        // Verifica todos os dias registrados pelo usuário
        if (dados.dias) {
            for (const [data, total] of Object.entries(dados.dias)) {
                // Se a data iniciar com o mês selecionado (Ex: "2024-05")
                if (data.startsWith(mesSelecionado)) {
                    if (dados.goal > 0 && total >= dados.goal) {
                        diasAtingidos++;
                    }
                }
            }
        }

        rankingArray.push({
            nome: dados.nome || "Usuário", 
            dias: diasAtingidos
        });
    });

    // Ordena do maior número de dias atingidos para o menor
    rankingArray.sort((a, b) => b.dias - a.dias);
    
    rankingArray.forEach(user => {
        const badge = user.dias > 0 ? '🏆' : '';
        const borderClass = user.dias > 0 ? 'goal-reached' : '';
        
        rankingList.innerHTML += `
            <div class="ranking-item ${borderClass}">
                <div>
                    <strong>${user.nome}</strong>
                </div>
                <div style="font-weight: bold; color: #0077b6;">
                    ${user.dias} dias ${badge}
                </div>
            </div>
        `;
    });
};

window.mudarDataRanking = function() {
    window.renderizarRanking();
};

window.mudarDataMensal = function() {
    window.renderizarRankingMensal();
};

function carregarDashboard() {
    const usuariosRef = collection(db, "usuarios");
    
    if (unsubDashboard) unsubDashboard(); 
    
    unsubDashboard = onSnapshot(usuariosRef, (snapshot) => {
        dadosGlobais = []; 
        snapshot.forEach((docSnap) => {
            dadosGlobais.push(docSnap.data());
        });
        
        window.renderizarRanking(); 
        window.renderizarRankingMensal(); // Atualiza ambos os rankings em tempo real
    });
}
