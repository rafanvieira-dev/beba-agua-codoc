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

// Exibe o nome e a foto da conta Google no menu lateral.
function atualizarIdentidadeMenu(user, dados = {}) {
    const container = document.getElementById('sidebar-user');
    const nome = dados.nome || user?.displayName || user?.email || 'Usuário';
    const foto = user?.photoURL || dados.foto || '';
    const img = document.getElementById('sidebar-avatar-image');
    const inicial = document.getElementById('sidebar-avatar-initial');

    document.getElementById('sidebar-user-name').textContent = nome;
    inicial.textContent = nome.trim().charAt(0).toUpperCase() || 'U';
    img.hidden = true;
    inicial.hidden = false;
    img.onerror = () => { img.hidden = true; inicial.hidden = false; };
    img.onload = () => { img.hidden = false; inicial.hidden = true; };

    if (foto.startsWith('https://')) img.src = foto;
    else img.removeAttribute('src');

    container.classList.remove('hidden');
}

// Monitorar o estado de autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            currentUser = user.uid;
            atualizarIdentidadeMenu(user, userSnap.data());
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
        document.getElementById('sidebar-user').classList.add('hidden');
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
            atualizarIdentidadeMenu(user, userSnap.data());
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
    atualizarIdentidadeMenu(user, { nome: user.displayName, foto: user.photoURL });
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
        
        if(unsubDashboard) unsubDashboard(); 
        
        window.showScreen('auth-screen');
    } catch (error) {
        console.error("Erro ao sair: ", error);
    }
};

// Funções para Editar o Perfil
window.toggleEditProfile = async function() {
    const form = document.getElementById('edit-profile-form');
    form.classList.toggle('hidden');
    
    // Se estiver abrindo o form, busca os dados atuais para preencher os inputs
    if (!form.classList.contains('hidden')) {
        const userRef = doc(db, "usuarios", currentUser);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const dados = userSnap.data();
            document.getElementById('edit-age').value = dados.age || '';
            document.getElementById('edit-weight').value = dados.weight || '';
            document.getElementById('edit-height').value = dados.height || '';
        }
    }
};

window.salvarEdicaoPerfil = async function() {
    const weight = document.getElementById('edit-weight').value;
    const height = document.getElementById('edit-height').value;
    const age = document.getElementById('edit-age').value;

    if (!weight || !height || !age) return alert('Por favor, preencha todos os campos!');

    // Recalcula a nova meta baseada no novo peso
    const newGoal = Math.round(weight * 35);
    const userRef = doc(db, "usuarios", currentUser);

    const btn = document.querySelector('#edit-profile-form .action-btn-large');
    btn.disabled = true;
    btn.innerText = 'Salvando...';

    // Atualiza apenas os campos específicos no Firebase
    await updateDoc(userRef, {
        weight: weight,
        height: height,
        age: age,
        goal: newGoal
    });

    btn.disabled = false;
    btn.innerText = 'Salvar Nova Meta';

    document.getElementById('edit-profile-form').classList.add('hidden');
    
    // Atualiza a interface
    carregarPerfil();
};

window.showScreen = function(screenId) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('monthly-ranking-screen').classList.add('hidden');
    document.getElementById('profile-screen').classList.add('hidden');
    // Esconde o formulário de edição se estiver navegando entre telas
    document.getElementById('edit-profile-form').classList.add('hidden');
    
    document.getElementById(screenId).classList.remove('hidden');

    if (screenId === 'profile-screen' && currentUser) carregarPerfil();
    
    if (screenId === 'dashboard-screen' || screenId === 'monthly-ranking-screen') {
        if (screenId === 'dashboard-screen') document.getElementById('ranking-date').value = getTodayDate();
        if (screenId === 'monthly-ranking-screen') document.getElementById('monthly-date').value = getCurrentMonth();
        carregarDashboard();
    }
};


function formatarMl(valor) {
    return new Intl.NumberFormat('pt-BR').format(valor || 0) + ' ml';
}

function obterDataLocal(offsetDias) {
    const data = new Date();
    data.setDate(data.getDate() + offsetDias);
    data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
    return data.toISOString().slice(0, 10);
}

function renderizarGrafico(elementId, resumoId, registros, compacto = false) {
    const chart = document.getElementById(elementId);
    const summary = document.getElementById(resumoId);
    if (!chart || !summary) return;

    const valores = registros.map(item => Math.max(0, Number(item.valor) || 0));
    const maximo = Math.max(...valores, 1);
    chart.innerHTML = registros.map((item, index) => {
        const valor = valores[index];
        const altura = valor > 0 ? Math.max(5, Math.round((valor / maximo) * 100)) : 3;
        const label = item.rotulo;
        const ml = formatarMl(valor);
        return `<div class="bar-column" title="${label}: ${ml}">
            <span class="bar-value">${valor > 0 ? (valor >= 1000 ? (valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'L' : valor) : '—'}</span>
            <div class="bar" style="height:${altura}%"></div>
            <span class="bar-label">${label}</span>
        </div>`;
    }).join('');

    const total = valores.reduce((soma, valor) => soma + valor, 0);
    const diasComRegistro = valores.filter(valor => valor > 0).length;
    const media = registros.length ? Math.round(total / registros.length) : 0;
    summary.innerHTML = `<span>Total: <strong>${formatarMl(total)}</strong></span><span>Média/dia: <strong>${formatarMl(media)}</strong></span>`;
}

function renderizarGraficosHidratacao(dados) {
    const dias = dados.dias || {};
    const hoje = obterDataLocal(0);
    const semana = [];
    for (let i = -6; i <= 0; i++) {
        const data = obterDataLocal(i);
        const valor = data === hoje && dados.ultimaAtualizacao === hoje
            ? Math.max(Number(dias[data]) || 0, Number(dados.totalHoje) || 0)
            : Number(dias[data]) || 0;
        semana.push({ rotulo: new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), valor });
    }
    const mes = [];
    for (let i = -29; i <= 0; i++) {
        const data = obterDataLocal(i);
        const valor = data === hoje && dados.ultimaAtualizacao === hoje
            ? Math.max(Number(dias[data]) || 0, Number(dados.totalHoje) || 0)
            : Number(dias[data]) || 0;
        mes.push({ rotulo: i === 0 ? 'Hoje' : (i % 5 === 0 ? data.slice(8, 10) : ''), valor });
    }
    renderizarGrafico('weekly-chart', 'weekly-summary', semana);
    renderizarGrafico('monthly-chart', 'monthly-summary', mes, true);
}

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
    const avatarImage = document.getElementById('user-avatar-image');
    const avatarInitial = document.getElementById('user-avatar-initial');
    avatarInitial.textContent = String(dados.nome || 'Usuário').trim().charAt(0).toUpperCase() || 'U';
    avatarImage.hidden = true;
    avatarInitial.hidden = false;
    avatarImage.onerror = () => { avatarImage.hidden = true; avatarInitial.hidden = false; };
    avatarImage.onload = () => { avatarImage.hidden = false; avatarInitial.hidden = true; };
    const fotoPerfil = auth.currentUser?.photoURL || dados.foto;
    if (fotoPerfil && fotoPerfil.startsWith('https://')) avatarImage.src = fotoPerfil;
    else avatarImage.removeAttribute('src');

    document.getElementById('user-goal').innerText = dados.goal;
    document.getElementById('user-current').innerText = dados.totalHoje;

    const metaDiaria = Math.max(0, Number(dados.goal) || 0);
    const consumoAtual = Math.max(0, Number(dados.totalHoje) || 0);
    const percentage = metaDiaria > 0
        ? Math.min((consumoAtual / metaDiaria) * 100, 100)
        : 0;

    const barra = document.getElementById('progress-fill');
    barra.style.width = `${percentage}%`;
    barra.setAttribute('aria-valuenow', String(Math.round(percentage)));
    barra.setAttribute('aria-valuemax', '100');
    document.getElementById('progress-text').innerText =
        `${Math.round(percentage)}% concluído · ${new Intl.NumberFormat('pt-BR').format(consumoAtual)} de ${new Intl.NumberFormat('pt-BR').format(metaDiaria)} ml`;

    renderizarGraficosHidratacao(dados);

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
    if (amount > 0) window.addWater(amount);
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
        if (partes.length === 3) subtitle.innerText = `Histórico do dia ${partes[2]}/${partes[1]}/${partes[0]}`;
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
                <div><strong>${user.nome}</strong></div>
                <div style="font-weight: bold; color: ${user.percentage >= 100 ? '#2ecc71' : '#555'};">${displayStatus}</div>
            </div>
        `;
    });
};

window.renderizarRankingMensal = function() {
    const mesSelecionado = document.getElementById('monthly-date').value || getCurrentMonth(); 
    const subtitle = document.getElementById('monthly-subtitle');
    
    const partes = mesSelecionado.split('-');
    if (partes.length === 2) subtitle.innerText = `Metas atingidas em ${partes[1]}/${partes[0]}`;
    
    const rankingList = document.getElementById('monthly-ranking-list');
    rankingList.innerHTML = '';
    let rankingArray = [];

    dadosGlobais.forEach((dados) => {
        let diasAtingidos = 0;
        if (dados.dias) {
            for (const [data, total] of Object.entries(dados.dias)) {
                if (data.startsWith(mesSelecionado)) {
                    if (dados.goal > 0 && total >= dados.goal) {
                        diasAtingidos++;
                    }
                }
            }
        }
        rankingArray.push({ nome: dados.nome || "Usuário", dias: diasAtingidos });
    });

    rankingArray.sort((a, b) => b.dias - a.dias);
    
    rankingArray.forEach(user => {
        const badge = user.dias > 0 ? '🏆' : '';
        const borderClass = user.dias > 0 ? 'goal-reached' : '';
        rankingList.innerHTML += `
            <div class="ranking-item ${borderClass}">
                <div><strong>${user.nome}</strong></div>
                <div style="font-weight: bold; color: #0077b6;">${user.dias} dias ${badge}</div>
            </div>
        `;
    });
};

window.mudarDataRanking = function() { window.renderizarRanking(); };
window.mudarDataMensal = function() { window.renderizarRankingMensal(); };

function carregarDashboard() {
    const usuariosRef = collection(db, "usuarios");
    if (unsubDashboard) unsubDashboard(); 
    
    unsubDashboard = onSnapshot(usuariosRef, (snapshot) => {
        dadosGlobais = []; 
        snapshot.forEach((docSnap) => {
            dadosGlobais.push(docSnap.data());
        });
        window.renderizarRanking(); 
        window.renderizarRankingMensal(); 
    });
}


// Instalação como aplicativo (PWA) em dispositivos compatíveis.
let promptInstalacaoPendente = null;
const botaoInstalar = document.getElementById('install-app-btn');
const dispositivoApple = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !('standalone' in navigator && navigator.standalone);

window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    promptInstalacaoPendente = evento;
    if (botaoInstalar) {
        botaoInstalar.textContent = 'Instalar aplicativo';
        botaoInstalar.classList.remove('hidden');
    }
});

if (dispositivoApple && botaoInstalar) {
    botaoInstalar.textContent = 'Como instalar';
    botaoInstalar.classList.remove('hidden');
}

if (botaoInstalar) {
    botaoInstalar.addEventListener('click', async () => {
        if (promptInstalacaoPendente) {
            promptInstalacaoPendente.prompt();
            await promptInstalacaoPendente.userChoice;
            promptInstalacaoPendente = null;
            botaoInstalar.classList.add('hidden');
        } else if (dispositivoApple) {
            alert('Para instalar no iPhone/iPad:\n1. Abra este site no Safari.\n2. Toque em Compartilhar.\n3. Escolha “Adicionar à Tela de Início”.\n4. Toque em Adicionar.');
        } else {
            alert('Para instalar, abra este site no Chrome ou navegador compatível e use o menu do navegador → “Instalar aplicativo” ou “Adicionar à tela inicial”.');
        }
    });
}

window.addEventListener('appinstalled', () => {
    if (botaoInstalar) botaoInstalar.classList.add('hidden');
    promptInstalacaoPendente = null;
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .catch((erro) => console.error('Não foi possível ativar o modo instalável:', erro));
    });
}
