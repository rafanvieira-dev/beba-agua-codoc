import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

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

let isRegistering = false;
let currentUser = null;
let unsubDashboard = null; // Para guardar a referência do listener em tempo real

const getTodayDate = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
};

window.toggleRegister = function() {
    isRegistering = !isRegistering;
    document.getElementById('register-fields').classList.toggle('hidden');
    document.getElementById('action-btn').innerText = isRegistering ? 'Cadastrar' : 'Entrar';
    document.querySelector('.toggle-link').innerText = isRegistering ? 'Já tem conta? Entre aqui' : 'Não tem conta? Cadastre-se';
};

window.loginOrRegister = async function() {
    const username = document.getElementById('username').value.trim();
    if (!username) return alert('Digite um nome!');

    const userRef = doc(db, "usuarios", username);
    const userSnap = await getDoc(userRef);

    if (isRegistering) {
        if (userSnap.exists()) return alert('Usuário já existe. Faça login!');

        const weight = document.getElementById('weight').value;
        const height = document.getElementById('height').value;
        const age = document.getElementById('age').value;

        if (!weight || !height || !age) return alert('Preencha todos os campos!');

        const goal = Math.round(weight * 35);

        await setDoc(userRef, {
            weight: weight,
            height: height,
            age: age,
            goal: goal,
            totalHoje: 0,
            historico: [],
            ultimaAtualizacao: getTodayDate()
        });
        alert('Cadastro realizado com sucesso!');
    } else {
        if (!userSnap.exists()) return alert('Usuário não encontrado!');
    }

    currentUser = username;
    document.getElementById('menu').classList.remove('hidden');
    window.showScreen('profile-screen');
};

window.logout = function() {
    currentUser = null;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('username').value = '';
    
    if(unsubDashboard) {
        unsubDashboard(); // Para de ouvir o banco ao deslogar
    }
    
    window.showScreen('auth-screen');
};

window.showScreen = function(screenId) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('profile-screen').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');

    if (screenId === 'profile-screen' && currentUser) carregarPerfil();
    if (screenId === 'dashboard-screen') carregarDashboard();
};

async function carregarPerfil() {
    const userRef = doc(db, "usuarios", currentUser);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return;
    let dados = userSnap.data();

    // Se virou o dia, zera o progresso localmente para a exibição
    if (dados.ultimaAtualizacao !== getTodayDate()) {
        dados.totalHoje = 0;
        dados.historico = [];
    }

    document.getElementById('user-greeting').innerText = `Olá, ${currentUser}!`;
    document.getElementById('user-goal').innerText = dados.goal;
    document.getElementById('user-current').innerText = dados.totalHoje;

    let percentage = (dados.totalHoje / dados.goal) * 100;
    if (percentage > 100) percentage = 100;
    
    document.getElementById('progress-fill').style.width = percentage + '%';
    document.getElementById('progress-text').innerText = Math.round(percentage) + '% concluído';

    const historyUl = document.getElementById('water-history');
    historyUl.innerHTML = '';
    
    // Inverte a ordem do histórico para o mais recente ficar no topo
    const historicoReverso = [...dados.historico].reverse();
    historicoReverso.forEach(entry => {
        historyUl.innerHTML += `<li>💧 ${entry.amount}ml às ${entry.time}</li>`;
    });
}

window.addWater = async function(amount) {
    if (!currentUser) return;

    const userRef = doc(db, "usuarios", currentUser);
    const userSnap = await getDoc(userRef);
    let dados = userSnap.data();
    
    let novoTotal = dados.totalHoje;
    let novoHistorico = dados.historico || [];

    // Lógica para zerar se virou o dia
    if (dados.ultimaAtualizacao !== getTodayDate()) {
        novoTotal = 0;
        novoHistorico = [];
    }

    novoTotal += amount;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    novoHistorico.push({ amount: amount, time: timeString });

    await updateDoc(userRef, {
        totalHoje: novoTotal,
        historico: novoHistorico,
        ultimaAtualizacao: getTodayDate()
    });

    carregarPerfil();
};

function carregarDashboard() {
    const usuariosRef = collection(db, "usuarios");
    
    // onSnapshot cria a conexão em tempo real com o banco
    unsubDashboard = onSnapshot(usuariosRef, (snapshot) => {
        const rankingList = document.getElementById('ranking-list');
        rankingList.innerHTML = '';
        let rankingArray = [];

        snapshot.forEach((docSnap) => {
            let dados = docSnap.data();
            
            // Só mostra a água bebida se for o dia de hoje
            let totalExibido = dados.ultimaAtualizacao === getTodayDate() ? dados.totalHoje : 0;
            let percentage = (totalExibido / dados.goal) * 100;

            rankingArray.push({
                name: docSnap.id,
                total: totalExibido,
                percentage: percentage
            });
        });

        // Ordena do maior para o menor %
        rankingArray.sort((a, b) => b.percentage - a.percentage);
        
        rankingArray.forEach(user => {
            const percArredondado = Math.min(Math.round(user.percentage), 100);
            const goalReached = user.percentage >= 100 ? 'goal-reached' : '';
            const statusIcon = user.percentage >= 100 ? '🏆' : '💧';
            
            rankingList.innerHTML += `
                <div class="ranking-item ${goalReached}">
                    <div>
                        <strong>${user.name}</strong><br>
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