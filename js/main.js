/* ============================================================
   EVALUACIÓN DE VULNERABILIDAD SANITARIA — ProControl México
   Lógica principal de la aplicación
   ============================================================ */

// ─── CONFIGURACIÓN ───────────────────────────────────────────

// Plazas de cobertura autorizadas
const AUTHORIZED_CITIES = [
    "CDMX y Área Metropolitana",
    "Yucatán (Mérida)",
    "Querétaro",
    "Guadalajara (ZMG)",
    "Chihuahua",
    "Tijuana",
    "Tapachula"
];

// Webhook de Google Apps Script para captura en segundo plano
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYlK5kxWDbQMD80cbryhaow-LZjTivXX4-UAUUCKhXQji2zHoY8Md23xctAKjaw8BFVw/exec";

// URLs de fallback para imágenes (local primero, luego CDNs)
const ESCUDO_FALLBACK_URLS = [
    './Imagenes/Escudo Procontrol.png',
    'https://raw.githubusercontent.com/gavainc/Procontrol-Mexico/main/Escudo%20procontrol.png',
    'https://github.com/gavainc/Procontrol-Mexico/blob/main/Escudo%20procontrol.png?raw=true',
    'https://raw.githubusercontent.com/gavainc/Procontrol-Mexico/main/Escudo%20Procontrol.png',
    'https://crm-procontrol.web.app/Escudo%20procontrol.png',
    'https://crm-procontrol.web.app/Escudo%20Procontrol.png'
];

const QR_FALLBACK_URLS = [
    './Imagenes/QR Procontrol.png',
    'https://raw.githubusercontent.com/gavainc/Procontrol-Mexico/main/QR%20Procontrol.png',
    'https://github.com/gavainc/Procontrol-Mexico/blob/main/QR%20Procontrol.png?raw=true',
    'https://raw.githubusercontent.com/gavainc/Procontrol-Mexico/main/QR%20procontrol.png',
    'https://crm-procontrol.web.app/QR%20Procontrol.png',
    'https://crm-procontrol.web.app/QR%20procontrol.png'
];

// ─── MANEJADORES DE ERROR DE IMÁGENES ────────────────────────

function handleEscudoError(img) {
    let attempt = parseInt(img.dataset.attempt || '0', 10);
    attempt++;
    img.dataset.attempt = attempt;
    if (attempt < ESCUDO_FALLBACK_URLS.length) {
        img.src = ESCUDO_FALLBACK_URLS[attempt];
    } else {
        img.outerHTML = `
            <div class="h-32 w-28 border border-sky-500/40 rounded-xl bg-sky-950/40 flex flex-col items-center justify-center p-2 text-center shadow-inner">
                <i class="fa-solid fa-shield-halved text-sky-400 text-3xl mb-1"></i>
                <span class="text-[10px] font-black text-white uppercase tracking-tighter">ProControl</span>
            </div>`;
    }
}

function handleQrError(img) {
    let attempt = parseInt(img.dataset.attempt || '0', 10);
    attempt++;
    img.dataset.attempt = attempt;
    if (attempt < QR_FALLBACK_URLS.length) {
        img.src = QR_FALLBACK_URLS[attempt];
    } else {
        img.outerHTML = `
            <div class="h-28 w-28 bg-white rounded-xl p-2.5 flex flex-col items-center justify-center text-slate-900 text-center shadow-lg">
                <i class="fa-solid fa-qrcode text-4xl text-slate-900 mb-1"></i>
                <span class="text-[9px] font-bold tracking-tighter text-slate-700">vCard</span>
            </div>`;
    }
}

// ─── UTILIDADES DE FORMULARIO ─────────────────────────────────

// Limpiador y validador de teléfono (solo 10 dígitos numéricos)
function cleanPhoneInput(input, counterId, errorId) {
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
    const len = input.value.length;
    const counter = document.getElementById(counterId);
    const err = document.getElementById(errorId);

    if (counter) {
        counter.innerText = `${len}/10 dígitos`;
        if (len === 10) {
            counter.className = "text-[11px] font-mono text-emerald-400 font-bold";
            input.classList.remove('border-rose-500');
            input.classList.add('border-emerald-500');
            if (err) err.classList.add('hidden');
        } else {
            counter.className = "text-[11px] font-mono text-slate-400";
            input.classList.remove('border-emerald-500');
        }
    }
}

// Control de habilitación del botón de envío con checkbox de privacidad
function toggleDirectSubmitBtn(checkbox) {
    const btn = document.getElementById('direct-submit-btn');
    if (!btn) return;
    if (checkbox.checked) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.classList.add('hover:from-emerald-500', 'hover:to-teal-600', 'shadow-emerald-900/30', 'cursor-pointer');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.classList.remove('hover:from-emerald-500', 'hover:to-teal-600', 'shadow-emerald-900/30', 'cursor-pointer');
    }
}

function toggleQuizSubmitBtn(checkbox) {
    const btn = document.getElementById('quiz-submit-btn');
    if (!btn) return;
    if (checkbox.checked) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.classList.add('hover:from-sky-500', 'hover:to-blue-500', 'shadow-sky-600/30', 'cursor-pointer');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.classList.remove('hover:from-sky-500', 'hover:to-blue-500', 'shadow-sky-600/30', 'cursor-pointer');
    }
}

// ─── MODAL DE PRIVACIDAD ──────────────────────────────────────

function openPrivacyModal() {
    document.getElementById('privacy-modal').classList.remove('hidden');
}

function closePrivacyModal() {
    document.getElementById('privacy-modal').classList.add('hidden');
}

function centerScrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

// ─── GOOGLE SHEETS ────────────────────────────────────────────

// Envío asíncrono a Google Sheets en segundo plano (no-cors)
async function sendToGoogleSheets(payload) {
    if (!SCRIPT_URL || SCRIPT_URL.includes("YOUR_SCRIPT_ID")) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.warn("Aviso de registro en segundo plano:", err);
    }
}

// ─── DATOS DEL CUESTIONARIO ───────────────────────────────────

const quizData = [
    {
        moduleTitle: "1. CARPETA MIP Y TRAZABILIDAD DOCUMENTAL",
        hasTrigger: true,
        questions: [
            { id: "q1_1", title: "1.1 Licencia Sanitaria del Proveedor MIP", desc: "Licencia Sanitaria expedida por COFEPRIS / Salud estatal vigente en la carpeta técnica.", type: "critical" },
            { id: "q1_2", title: "1.2 Contrato / Póliza de Servicio Vigente", desc: "Servicio constante y programa maestro firmado por empresa especializada con Licencia Sanitaria.", type: "critical" },
            { id: "q1_3", title: "1.3 Fichas Técnicas de Productos Químicos", desc: "Fichas técnicas de los plaguicidas autorizados a emplear en el inmueble.", type: "general" },
            { id: "q1_4", title: "1.4 Hojas de Datos de Seguridad (HDS / MSDS)", desc: "HDS con protocolo toxicológico y primeros auxilios en carpeta.", type: "general" },
            { id: "q1_5", title: "1.5 Registro COFEPRIS / CICOPLAFEST de Plaguicidas", desc: "Registros de plaguicidas autorizados exclusivamente para uso urbano o alimentario.", type: "general" },
            { id: "q1_6", title: "1.6 Croquis / Plano Numerado de Dispositivos", desc: "Mapa del inmueble con la ubicación exacta y número de cada trampa o estación.", type: "general" },
            { id: "q1_7", title: "1.7 Carpeta MIP y Bitácora de Servicio Actualizada", desc: "Evidencia documental completa, hojas de servicio firmadas y trazabilidad al día.", type: "critical" }
        ]
    },
    {
        moduleTitle: "2. EVIDENCIA FÍSICA Y ACTIVIDAD DE PLAGAS",
        hasTrigger: false,
        questions: [
            { id: "q2_1", title: "2.1 Ausencia Total de Evidencia o Plagas Activas", desc: "Marca CUMPLE si tus instalaciones (cocina, almacén, barra) se encuentran 100% libres de insectos, roedores, aves o excretas. Marca NO CUMPLE si has detectado plagas o bioindicadores.", type: "critical" },
            { id: "q2_2", title: "2.2 Restos Biológicos de Plagas (Exuvias, Ootecas, Larvas o Pupas)", desc: "Marca CUMPLE si no hay mudas de insectos, ootecas de cucaracha, pupas o larvas en grietas, rincones o bajo equipos. Marca NO CUMPLE si has hallado este tipo de restos.", type: "critical" },
            { id: "q2_3", title: "2.3 Marcas o Daños por Mordeduras de Roedores", desc: "Marca CUMPLE si empaques, cableado, estructuras y mobiliario están intactos sin marcas de roído. Marca NO CUMPLE si hay estructuras u objetos mordidos.", type: "critical" },
            { id: "q2_4", title: "2.4 Olores Característicos de Infestación Activa", desc: "Marca CUMPLE si el ambiente está libre de olores fétidos, humedad intensa u olores almizclados de roedor. Marca NO CUMPLE si percibes estos olores.", type: "critical" }
        ]
    },
    {
        moduleTitle: "3. INOCUIDAD — ALMACENES, COCINA Y BUENAS PRÁCTICAS",
        hasTrigger: false,
        questions: [
            { id: "q3_1", title: "3.1 Regla de Estiba (15 cm del piso / Tarimas)", desc: "Alimentos e insumos elevados del piso sobre anaqueles o tarimas inoxidables/plásticas.", type: "general" },
            { id: "q3_2", title: "3.2 Control y Eliminación de Cartón Corrugado", desc: "Prohibición de mantener cajas de empaque original del proveedor en cocina o almacén.", type: "general" },
            { id: "q3_3", title: "3.3 Resguardo de Graneles en Contenedores Herméticos", desc: "Harinas, granos y azúcares guardados en contenedores plásticos grado alimenticio con tapa.", type: "general" },
            { id: "q3_4", title: "3.4 Acumulación de Grasa Orgánica en Equipos y Motores", desc: "Limpieza de grasa debajo de freidoras, estufas y motores de refrigeración.", type: "general" },
            { id: "q3_5", title: "3.5 Mantenimiento y Desazolve de Trampas de Grasa", desc: "Trampas de grasa sin saturación de sólidos/capas de grasa, con sellado de tapa y sin malos olores.", type: "general" },
            { id: "q3_6", title: "3.6 Coladeras, Rejillas y Sello Hidráulico en Drenajes", desc: "Rejillas limpias sin lodos orgánicos acumulados y coladeras con sello hidráulico activo para evitar moscas del drenaje.", type: "general" },
            { id: "q3_7", title: "3.7 Integridad y Sellado de Tapas de Trampas de Grasa", desc: "Tapas de trampas de grasa sin daños, con sellado hermético que evite fugas de olor o acceso de fauna.", type: "general" },
            { id: "q3_8", title: "3.8 Limpieza Debajo de Mobiliario y Estantería", desc: "Áreas bajo mobiliario, estantería y anaqueles libres de suciedad, polvo o residuos acumulados.", type: "general" },
            { id: "q3_9", title: "3.9 Contenedores de Basura en Buen Estado y con Tapa Hermética", desc: "Contenedores de basura limpios, sin daños y equipados con tapa hermética.", type: "general" },
            { id: "q3_10", title: "3.10 Ausencia de Desperdicios Orgánicos Expuestos Fuera de Contenedores", desc: "Sin bolsas, restos de comida u otros desperdicios orgánicos fuera de los contenedores.", type: "general" }
        ]
    },
    {
        moduleTitle: "4. INFRAESTRUCTURA, EXCLUSIÓN Y HERMETICIDAD",
        hasTrigger: false,
        questions: [
            { id: "q4_1", title: "4.1 Guardapolvos y Holguras en Puertas Exteriores", desc: "Holgura inferior en puertas de acceso/servicio menor a 6 mm.", type: "general" },
            { id: "q4_2", title: "4.2 Mallas Mosquiteras en Ventanas y Ventilación", desc: "Protección contra voladores en ventanas de cocina, barra o almacén.", type: "general" },
            { id: "q4_3", title: "4.3 Sellado de Fisuras, Azulejos y Pasamuros", desc: "Ausencia de grietas o perforaciones de tuberías sin sellar que sirvan de refugio.", type: "general" },
            { id: "q4_4", title: "4.4 Sistemas de Cierre Automático en Puertas", desc: "Brazos hidráulicos o resortes de cierre operando correctamente en puertas de acceso/servicio.", type: "general" },
            { id: "q4_5", title: "4.5 Uniones Estructurales y Mampostería", desc: "Paredes, muros y uniones estructurales libres de huecos, aberturas o grietas que sirvan de acceso.", type: "general" },
            { id: "q4_6", title: "4.6 Perímetro Exterior Libre de Maleza Alta", desc: "Vegetación perimetral controlada; sin maleza alta que sirva de refugio a fauna nociva.", type: "general" },
            { id: "q4_7", title: "4.7 Perímetro Exterior Libre de Escombros o Materiales en Desuso", desc: "Perímetro exterior libre de escombros, mobiliario en desuso o materiales acumulados que sirvan de refugio.", type: "general" }
        ]
    },
    {
        moduleTitle: "5. RESGUARDO DE QUÍMICOS Y NORMATIVA DE DISPOSITIVOS",
        hasTrigger: false,
        questions: [
            { id: "q5_1", title: "5.1 Almacenamiento Exclusivo de Químicos y Plaguicidas", desc: "Gabinete o área aislada bajo llave, separada de alimentos y utensilios.", type: "critical" },
            { id: "q5_2", title: "5.2 Restricción de Cebos Tóxicos en Áreas Interiores", desc: "Prohibido el uso de venenos/cebos tóxicos dentro de cocina, almacén o barra (solo mecánicas/engomados).", type: "critical" },
            { id: "q5_3", title: "5.3 Prohibición de Lámparas Electrocutoras (\"Zappers\")", desc: "NMX-F-605-NORMEX y NOM-251-SSA1 prohíben insectocutores de choque eléctrico en áreas de alimentos (solo trampas UV de lámina pegajosa).", type: "critical" },
            { id: "q5_4", title: "5.4 Operatividad y Limpieza de Trampas Mecánicas e Interiores", desc: "Revisión de operatividad, sustitución y limpieza de trampas de pegamento, captura viva o impacto en interiores.", type: "general" },
            { id: "q5_5", title: "5.5 Ubicación Adecuada de Lámparas Atrapa-Insectos UV", desc: "Verificación de que NO estén instaladas directamente sobre mesas de preparación o estufas.", type: "general" },
            { id: "q5_6", title: "5.6 Mantenimiento, Encendido y Tubos UV", desc: "Equipos encendidos 24/7, con láminas adhesivas limpias y reemplazo de tubos dentro del espectro UV.", type: "general" },
            { id: "q5_7", title: "5.7 Estaciones Cebaderas Perimetrales Exteriores", desc: "Instaladas exclusivamente en el perímetro exterior, cerradas con llave y fijadas.", type: "general" }
        ]
    }
];

// ─── ESTADO DEL QUIZ ──────────────────────────────────────────

let flatQuestionsList = [
    {
        isTrigger: true,
        id: "trigger_mip",
        moduleTitle: "1. SERVICIO Y TRAZABILIDAD",
        title: "¿Actualmente cuenta con servicio profesional de control de plagas contratado?",
        desc: "Indica si dispones de un servicio constante y programa maestro activo de control de plagas con proveedor especializado."
    }
];

quizData.forEach(mod => {
    mod.questions.forEach(q => {
        flatQuestionsList.push({
            ...q,
            isTrigger: false,
            moduleTitle: mod.moduleTitle
        });
    });
});

let currentQIndex = 0;
let quizAnswers = {};
let quizCompany = "";
let quizName = "";
let quizCity = "";
let quizPhone = "";
let quizEmail = "";
let hasMipService = true;
let lastDirectLeadData = null;

// ─── NAVEGACIÓN DE RUTAS ──────────────────────────────────────

function setActivePath(path) {
    const btnDirect = document.getElementById('tab-direct-btn');
    const btnQuiz = document.getElementById('tab-quiz-btn');
    const secDirect = document.getElementById('path-direct-section');
    const secQuiz = document.getElementById('path-quiz-section');
    const pathSelector = document.getElementById('dual-path-selector');

    if (path === 'direct') {
        pathSelector.classList.remove('hidden');
        btnDirect.className = "group p-5 rounded-xl bg-slate-800/90 border-2 border-sky-500/80 text-left transition-all duration-300 hover:border-sky-400 focus:outline-none pulse-glow relative overflow-hidden";
        btnQuiz.className = "group p-5 rounded-xl bg-slate-800/40 border-2 border-slate-700 text-left transition-all duration-300 hover:border-slate-500 focus:outline-none relative overflow-hidden";
        secDirect.classList.remove('hidden');
        secQuiz.classList.add('hidden');
        secDirect.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (path === 'quiz') {
        pathSelector.classList.add('hidden');
        secQuiz.classList.remove('hidden');
        secDirect.classList.add('hidden');
        document.getElementById('quiz-step-engine').classList.remove('hidden');
        document.getElementById('quiz-step-lead-capture').classList.add('hidden');
        document.getElementById('quiz-step-results').classList.add('hidden');
        renderSingleQuestion(0);
        secQuiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ─── RUTA 1: FORMULARIO DE INSPECCIÓN PRESENCIAL ─────────────

async function handleDirectFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('direct-name').value.trim();
    const company = document.getElementById('direct-company').value.trim();
    const sector = document.getElementById('direct-sector').value;
    const city = document.getElementById('direct-city').value;
    const phone = document.getElementById('direct-phone').value.replace(/\D/g, '');
    const email = document.getElementById('direct-email').value.trim();
    const notes = document.getElementById('direct-notes').value.trim();
    const privacyChecked = document.getElementById('direct-privacy-check').checked;

    // Validación estricta de ciudad autorizada
    const cityError = document.getElementById('direct-city-error');
    if (!AUTHORIZED_CITIES.includes(city)) {
        cityError.classList.remove('hidden');
        document.getElementById('direct-city').focus();
        return;
    } else {
        cityError.classList.add('hidden');
    }

    if (phone.length !== 10) {
        document.getElementById('direct-phone-error').classList.remove('hidden');
        document.getElementById('direct-phone').focus();
        return;
    }

    if (!privacyChecked) return;

    lastDirectLeadData = { name, company, sector, city, phone, email: email || 'No especificado', notes };

    // Captura asíncrona a Google Sheets en segundo plano
    sendToGoogleSheets({
        fecha_hora: new Date().toISOString(),
        tipo_lead: "Inspección Directa",
        empresa: company,
        responsable: name,
        tipo_establecimiento: sector,
        ciudad: city,
        telefono: phone,
        correo: email || 'No especificado',
        notas: notes || 'N/A',
        aviso_privacidad: "Aceptado"
    });

    const text = `¡Hola, ProControl México! Solicito una Inspección Presencial en Sitio.\n\n*Empresa:* ${company}\n*Contacto:* ${name}\n*Tipo de Establecimiento:* ${sector}\n*Plaza / Ciudad:* ${city}\n*Teléfono:* ${phone}\n*Correo:* ${email || 'No especificado'}\n*Notas:* ${notes || 'N/A'}\n\n_[Origen: Río Social media]_`;
    window.open(`https://api.whatsapp.com/send?phone=525540014294&text=${encodeURIComponent(text)}`, '_blank');

    document.getElementById('direct-visit-form').classList.add('hidden');
    document.getElementById('direct-success-modal').classList.remove('hidden');
}

function openDirectWhatsApp() {
    if (!lastDirectLeadData) return;
    const text = `¡Hola, ProControl México! Solicito una Inspección Presencial en Sitio.\n\n*Empresa:* ${lastDirectLeadData.company}\n*Contacto:* ${lastDirectLeadData.name}\n*Tipo de Establecimiento:* ${lastDirectLeadData.sector}\n*Plaza / Ciudad:* ${lastDirectLeadData.city}\n*Teléfono:* ${lastDirectLeadData.phone}\n*Correo:* ${lastDirectLeadData.email}\n*Notas:* ${lastDirectLeadData.notes || 'N/A'}\n\n_[Origen: Río Social media]_`;
    window.open(`https://api.whatsapp.com/send?phone=525540014294&text=${encodeURIComponent(text)}`, '_blank');
}

// ─── RUTA 2: MOTOR DEL CUESTIONARIO ──────────────────────────

function getStepInfo(index) {
    if (!hasMipService) {
        const totalActive = 1 + 28;
        let stepNum = 1;
        if (index > 0) stepNum = index - 7 + 1;
        return { currentStep: stepNum, totalSteps: totalActive };
    } else {
        return { currentStep: index + 1, totalSteps: flatQuestionsList.length };
    }
}

function renderSingleQuestion(index) {
    currentQIndex = index;
    const q = flatQuestionsList[index];
    const stepInfo = getStepInfo(index);

    document.getElementById('quiz-module-indicator').innerText = `Pregunta ${stepInfo.currentStep} de ${stepInfo.totalSteps}`;
    const percent = Math.round((stepInfo.currentStep / stepInfo.totalSteps) * 100);
    document.getElementById('quiz-progress-percent').innerText = `${percent}% Completado`;
    document.getElementById('quiz-progress-fill').style.width = `${percent}%`;
    document.getElementById('quiz-prev-btn').classList.toggle('hidden', index === 0);

    const container = document.getElementById('quiz-questions-container');
    const accent = q.type === 'critical' ? 'border-l-red-500' : 'border-l-sky-500';
    let html = `
        <div class="quiz-question-enter">
            <div class="flex items-center justify-between mb-3.5 px-0.5">
                <span class="inline-flex items-center gap-1.5 text-[11px] font-black text-sky-400 uppercase tracking-widest">
                    <i class="fa-solid fa-layer-group text-[10px]"></i> ${q.moduleTitle}
                </span>
                ${q.type === 'critical' ? '<span class="inline-flex items-center gap-1 bg-red-950 text-red-400 border border-red-800/80 text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-inner"><i class="fa-solid fa-triangle-exclamation"></i> Punto Crítico</span>' : ''}
                ${q.type === 'general' ? '<span class="inline-flex items-center gap-1 bg-sky-950 text-sky-400 border border-sky-800/80 text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-inner"><i class="fa-solid fa-circle-info"></i> Punto General</span>' : ''}
            </div>

            <div class="bg-slate-900/90 border border-slate-700/80 border-l-4 ${accent} rounded-2xl p-5 md:p-7 shadow-xl mb-5">
                <h3 class="text-lg md:text-xl font-bold text-white mb-2.5 leading-snug">${q.title}</h3>
                <p class="text-xs md:text-sm text-slate-400 leading-relaxed mb-7">${q.desc}</p>
    `;

    if (q.isTrigger) {
        html += `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button type="button" onclick="selectTriggerAnswer(true)" class="quiz-option ${hasMipService ? 'quiz-option-active border-sky-500 bg-sky-950/40' : 'border-slate-700 bg-slate-800/40 hover:border-sky-500/70'} group p-4 rounded-xl border-2 transition flex items-center gap-3.5">
                    <span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base ${hasMipService ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-700/50 text-slate-400 group-hover:text-sky-400'} transition">
                        <i class="fa-solid fa-check"></i>
                    </span>
                    <span class="text-xs font-bold uppercase tracking-wider ${hasMipService ? 'text-white' : 'text-slate-300'}">Sí cuento con servicio</span>
                </button>
                <button type="button" onclick="selectTriggerAnswer(false)" class="quiz-option ${!hasMipService ? 'quiz-option-active border-amber-500 bg-amber-950/40' : 'border-slate-700 bg-slate-800/40 hover:border-amber-500/70'} group p-4 rounded-xl border-2 transition flex items-center gap-3.5">
                    <span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base ${!hasMipService ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-400 group-hover:text-amber-400'} transition">
                        <i class="fa-solid fa-xmark"></i>
                    </span>
                    <span class="text-xs font-bold uppercase tracking-wider ${!hasMipService ? 'text-white' : 'text-slate-300'}">No cuento con servicio</span>
                </button>
            </div>
        `;
    } else {
        const currentVal = quizAnswers[q.id] ? quizAnswers[q.id].val : '';
        html += `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button type="button" onclick="selectOptionAnswer('${q.id}', 'yes', '${q.type}')" class="quiz-option ${currentVal === 'yes' ? 'quiz-option-active border-emerald-500 bg-emerald-950/40' : 'border-slate-700 bg-slate-800/40 hover:border-emerald-500/70'} group p-4 rounded-xl border-2 transition flex flex-col items-center justify-center gap-2">
                    <span class="w-9 h-9 rounded-full flex items-center justify-center text-sm ${currentVal === 'yes' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400 group-hover:text-emerald-400'} transition">
                        <i class="fa-solid fa-check"></i>
                    </span>
                    <span class="text-xs font-extrabold uppercase tracking-wider ${currentVal === 'yes' ? 'text-emerald-400' : 'text-slate-300'}">Cumple</span>
                </button>
                <button type="button" onclick="selectOptionAnswer('${q.id}', 'no', '${q.type}')" class="quiz-option ${currentVal === 'no' ? 'quiz-option-active border-red-500 bg-red-950/40' : 'border-slate-700 bg-slate-800/40 hover:border-red-500/70'} group p-4 rounded-xl border-2 transition flex flex-col items-center justify-center gap-2">
                    <span class="w-9 h-9 rounded-full flex items-center justify-center text-sm ${currentVal === 'no' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-slate-400 group-hover:text-red-400'} transition">
                        <i class="fa-solid fa-xmark"></i>
                    </span>
                    <span class="text-xs font-extrabold uppercase tracking-wider ${currentVal === 'no' ? 'text-red-400' : 'text-slate-300'}">No Cumple</span>
                </button>
                <button type="button" onclick="selectOptionAnswer('${q.id}', 'na', '${q.type}')" class="quiz-option ${currentVal === 'na' ? 'quiz-option-active border-slate-400 bg-slate-800' : 'border-slate-700 bg-slate-800/40 hover:border-slate-400/70'} group p-4 rounded-xl border-2 transition flex flex-col items-center justify-center gap-2">
                    <span class="w-9 h-9 rounded-full flex items-center justify-center text-sm ${currentVal === 'na' ? 'bg-slate-400/20 text-slate-200' : 'bg-slate-700/50 text-slate-400 group-hover:text-slate-200'} transition">
                        <i class="fa-solid fa-minus"></i>
                    </span>
                    <span class="text-xs font-extrabold uppercase tracking-wider ${currentVal === 'na' ? 'text-slate-200' : 'text-slate-400'}">No Aplica</span>
                </button>
            </div>
        `;
    }

    html += `</div></div>`;
    container.innerHTML = html;

    document.getElementById('quiz-next-btn').innerHTML = (stepInfo.currentStep === stepInfo.totalSteps)
        ? 'Finalizar y Ver Dictamen <i class="fa-solid fa-chart-pie ml-1"></i>'
        : 'Siguiente <i class="fa-solid fa-chevron-right ml-1"></i>';
}

function selectTriggerAnswer(hasService) {
    hasMipService = hasService;
    if (!hasService) {
        quizData[0].questions.forEach(q => {
            quizAnswers[q.id] = { val: 'no', type: q.type };
        });
    }
    renderSingleQuestion(0);
    setTimeout(() => { nextQuestion(); }, 260);
}

function selectOptionAnswer(qId, val, type) {
    quizAnswers[qId] = { val, type };
    renderSingleQuestion(currentQIndex);
    setTimeout(() => { nextQuestion(); }, 260);
}

function prevQuestion() {
    if (currentQIndex === 8 && !hasMipService) {
        renderSingleQuestion(0);
    } else if (currentQIndex > 0) {
        renderSingleQuestion(currentQIndex - 1);
    }
}

function nextQuestion() {
    let nextIdx = currentQIndex + 1;
    if (currentQIndex === 0 && !hasMipService) nextIdx = 8;

    if (nextIdx < flatQuestionsList.length) {
        renderSingleQuestion(nextIdx);
    } else {
        document.getElementById('quiz-step-engine').classList.add('hidden');
        document.getElementById('quiz-step-lead-capture').classList.remove('hidden');
        centerScrollToElement('quiz-step-lead-capture');
    }
}

// ─── CAPTURA DE LEAD POST-QUIZ ────────────────────────────────

function handleLeadCaptureSubmit(e) {
    e.preventDefault();
    const city = document.getElementById('quiz-city-input').value;
    const cityError = document.getElementById('quiz-city-error');

    if (!AUTHORIZED_CITIES.includes(city)) {
        cityError.classList.remove('hidden');
        document.getElementById('quiz-city-input').focus();
        return;
    } else {
        cityError.classList.add('hidden');
    }

    const phone = document.getElementById('quiz-phone-input').value.replace(/\D/g, '');
    if (phone.length !== 10) {
        document.getElementById('quiz-phone-error').classList.remove('hidden');
        document.getElementById('quiz-phone-input').focus();
        return;
    }

    const privacyChecked = document.getElementById('quiz-privacy-check').checked;
    if (!privacyChecked) return;

    quizCompany = document.getElementById('quiz-company-input').value.trim();
    quizName = document.getElementById('quiz-name-input').value.trim();
    quizCity = city;
    quizPhone = phone;
    const emailInput = document.getElementById('quiz-email-input').value.trim();
    quizEmail = emailInput || 'No proporcionado';

    calculateAndShowDashboard();
}

// ─── CÁLCULO Y VISUALIZACIÓN DEL DICTAMEN ────────────────────

function calculateAndShowDashboard() {
    let criticalTotal = 0, criticalPassed = 0;
    let generalTotal = 0, generalPassed = 0;
    let criticalFails = [], generalFails = [];

    quizData.forEach(mod => {
        mod.questions.forEach(q => {
            const ans = quizAnswers[q.id] ? quizAnswers[q.id].val : 'no';
            if (ans === 'na') return;

            if (q.type === 'critical') {
                criticalTotal++;
                if (ans === 'yes') criticalPassed++;
                else criticalFails.push(q.title);
            } else {
                generalTotal++;
                if (ans === 'yes') generalPassed++;
                else generalFails.push(q.title);
            }
        });
    });

    const generalPercent = generalTotal > 0 ? Math.round((generalPassed / generalTotal) * 100) : 100;

    // Envío en segundo plano al Google Sheets con datos completos
    sendToGoogleSheets({
        fecha_hora: new Date().toISOString(),
        tipo_lead: "Autodiagnóstico Express",
        empresa: quizCompany,
        responsable: quizName,
        ciudad: quizCity,
        telefono: quizPhone,
        correo: quizEmail,
        calificacion_criticos: `${criticalPassed} de ${criticalTotal}`,
        calificacion_generales: `${generalPercent}%`,
        fallas_criticas: criticalFails.join(" | ") || "Ninguna",
        fallas_generales: generalFails.join(" | ") || "Ninguna",
        aviso_privacidad: "Aceptado"
    });

    document.getElementById('quiz-step-lead-capture').classList.add('hidden');
    document.getElementById('quiz-step-results').classList.remove('hidden');

    const heroMain = document.getElementById('hero-main');
    const dualPathSelector = document.getElementById('dual-path-selector');
    if (heroMain) heroMain.classList.add('hidden');
    if (dualPathSelector) dualPathSelector.classList.add('hidden');

    centerScrollToElement('quiz-step-results');

    document.getElementById('res-company-val').innerText = quizCompany || 'N/A';
    document.getElementById('res-name-val').innerText = quizName || 'N/A';
    document.getElementById('res-city-val').innerText = quizCity || 'N/A';
    document.getElementById('res-city-badge').innerText = quizCity || 'N/A';
    document.getElementById('res-phone-val').innerText = quizPhone || 'N/A';
    document.getElementById('res-email-val').innerText = quizEmail || 'No proporcionado';
    document.getElementById('res-critical-val').innerText = `${criticalPassed} / ${criticalTotal}`;
    document.getElementById('res-general-val').innerText = `${generalPercent}%`;

    const banner = document.getElementById('res-status-banner');
    if (criticalPassed < criticalTotal) {
        banner.className = "rounded-xl p-4 text-center font-black text-xs md:text-sm uppercase tracking-wider mb-6 bg-red-950/80 text-red-400 border border-red-800";
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> RIESGO SANITARIO CRÍTICO: INCUMPLIMIENTO EN PUNTOS DE CERO TOLERANCIA`;
    } else if (generalPercent < 90) {
        banner.className = "rounded-xl p-4 text-center font-black text-xs md:text-sm uppercase tracking-wider mb-6 bg-amber-950/80 text-amber-400 border border-amber-800";
        banner.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-2"></i> RIESGO SANITARIO MODERADO: CUMPLIMIENTO GENERAL INFERIOR AL 90%`;
    } else {
        banner.className = "rounded-xl p-4 text-center font-black text-xs md:text-sm uppercase tracking-wider mb-6 bg-emerald-950/80 text-emerald-400 border border-emerald-800";
        banner.innerHTML = `<i class="fa-solid fa-circle-check mr-2"></i> CONFORMIDAD SANITARIA: CUMPLIMIENTO NORMATIVO SATISFACTORIO`;
    }
}

// ─── WHATSAPP ─────────────────────────────────────────────────

function getReportSummaryText() {
    const critVal = document.getElementById('res-critical-val').innerText;
    const genVal = document.getElementById('res-general-val').innerText;
    const bannerText = document.getElementById('res-status-banner').innerText;

    return `*DICTAMEN PRELIMINAR DE VULNERABILIDAD SANITARIA*\n*Normativa:* NMX-F-605-NORMEX / NOM-251-SSA1\n\n*Empresa:* ${quizCompany}\n*Responsable:* ${quizName}\n*Plaza / Ciudad:* ${quizCity}\n*Contacto:* ${quizPhone} | ${quizEmail}\n\n*Puntos Críticos (Req. 100%):* ${critVal}\n*Puntos Generales (Req. 90%):* ${genVal}\n*Semáforo de Riesgo:* ${bannerText}\n\n*Solicitud:* Deseo coordinar el levantamiento físico y plan de acción en sitio con un especialista de ProControl México.\n\n_[Origen: Río Social media]_`;
}

function sendReportToWhatsApp() {
    const summary = getReportSummaryText();
    window.open(`https://api.whatsapp.com/send?phone=525540014294&text=${encodeURIComponent(summary)}`, '_blank');
}

// ─── GENERACIÓN DE PDF ────────────────────────────────────────

// Cache de activos en Base64 para descarga inmediata
let cachedLogoBase64 = null;
let cachedEscudoBase64 = null;
let cachedQrBase64 = null;

// Convierte imágenes a Base64 sin bloquear el renderizado
async function fetchImageAsBase64(url, timeoutMs = 2000) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const resp = await fetch(url, { mode: 'cors', signal: controller.signal });
        clearTimeout(timer);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return null;
    }
}

// Precarga en segundo plano al iniciar la página
async function preloadAssets() {
    // 1. Logotipo — ruta local primero, luego CDNs de respaldo
    const logoUrls = [
        './Imagenes/Logo Procontrol Vectores.png',
        'https://crm-procontrol.web.app/Logo%20Procontrol.png',
        'https://raw.githubusercontent.com/gavainc/Procontrol-Mexico/main/Logo%20Procontrol.png',
        'https://gavainc.github.io/Reportes-ProControl/Logo%20Procontrol.png'
    ];
    for (const u of logoUrls) {
        if (cachedLogoBase64) break;
        cachedLogoBase64 = await fetchImageAsBase64(u, 3000);
    }

    // 2. Escudo Oficial
    for (const u of ESCUDO_FALLBACK_URLS) {
        if (cachedEscudoBase64) break;
        cachedEscudoBase64 = await fetchImageAsBase64(u, 1200);
    }

    // 3. Código QR Oficial
    for (const u of QR_FALLBACK_URLS) {
        if (cachedQrBase64) break;
        cachedQrBase64 = await fetchImageAsBase64(u, 1200);
    }
}

// Inicia la precarga silenciosa en segundo plano
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadAssets);
} else {
    preloadAssets();
}

function buildOfficialDocumentHTML(logoBase64, escudoBase64, qrBase64) {
    const critVal = document.getElementById('res-critical-val').innerText;
    const genVal = document.getElementById('res-general-val').innerText;
    const bannerText = document.getElementById('res-status-banner').innerText;
    const todayStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

    const logoSrc = (logoBase64 && logoBase64.startsWith('data:image'))
        ? logoBase64
        : './Imagenes/Logo Procontrol Vectores.png';

    const logoHtml = `<img src="${logoSrc}" style="height: 48px; width: auto; max-width: 240px; object-fit: contain; display: block; margin-right: 12px;" alt="ProControl logo" data-logo-attempt="0" onerror="(function(el){var f=['https://raw.githubusercontent.com/gavainc/Procontrol-Mexico/main/Logo%20Procontrol.png','https://gavainc.github.io/Reportes-ProControl/Logo%20Procontrol.png'];var i=parseInt(el.dataset.logoAttempt||'0');el.dataset.logoAttempt=i+1;if(i<f.length){el.src=f[i];}else{el.style.display='none';}})(this)" />`;

    const escudoSrc = (escudoBase64 && escudoBase64.startsWith('data:image'))
        ? escudoBase64
        : ESCUDO_FALLBACK_URLS[0];
    const escudoHtml = `<img src="${escudoSrc}" style="height: 140px; width: auto; max-height: 150px; object-fit: contain; display: block; margin: 0 auto;" data-escudo-attempt="0" onerror="(function(el){var f=${JSON.stringify(ESCUDO_FALLBACK_URLS)};var i=parseInt(el.dataset.escudoAttempt||'0');el.dataset.escudoAttempt=i+1;if(i<f.length){el.src=f[i];}else{el.style.display='none';}})(this)" />`;

    const qrSrc = (qrBase64 && qrBase64.startsWith('data:image'))
        ? qrBase64
        : QR_FALLBACK_URLS[0];
    const qrHtml = `<img src="${qrSrc}" style="height: 130px; width: 130px; border-radius: 8px; background-color: #ffffff; padding: 6px; object-fit: contain; margin: 0 auto; display: block;" data-qr-attempt="0" onerror="(function(el){var f=${JSON.stringify(QR_FALLBACK_URLS)};var i=parseInt(el.dataset.qrAttempt||'0');el.dataset.qrAttempt=i+1;if(i<f.length){el.src=f[i];}else{el.style.display='none';}})(this)" />`;

    return `
        <div style="background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); border: 1px solid #dbe3ee; border-radius: 12px; padding: 18px 18px 14px; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; color: #0f172a; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);">
            <div style="border-bottom: 1px solid #dfe7f0; padding-bottom: 12px; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; justify-content: flex-start; min-width: 0; flex: 1;">
                        ${logoHtml}
                    </div>
                    <div style="font-size: 9px; color: #475569; text-align: right; font-weight: 700; letter-spacing: 0.2px; white-space: nowrap;">
                        Fecha de Emisión: <span style="color: #0f172a; font-weight: 800;">${todayStr}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                    <span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; font-size: 8.5px; font-weight: 800; padding: 4px 11px; border-radius: 18px; display: inline-block; letter-spacing: 0.25px;">✓ NMX-F-610-NORMEX</span>
                    <span style="background: #1e293b; color: #fff; font-size: 8.5px; font-weight: 800; padding: 4px 11px; border-radius: 18px; display: inline-block; letter-spacing: 0.25px;">✓ ISO 9001:2015</span>
                    <span style="background: #1e293b; color: #fff; font-size: 8.5px; font-weight: 800; padding: 4px 11px; border-radius: 18px; display: inline-block; letter-spacing: 0.25px;">✓ ISO 14001:2015</span>
                    <span style="background: #1e293b; color: #fff; font-size: 8.5px; font-weight: 800; padding: 4px 11px; border-radius: 18px; display: inline-block; letter-spacing: 0.25px;">✓ ISO 45001:2018</span>
                </div>
            </div>

            <div style="text-align: center; margin-bottom: 14px;">
                <div style="font-size: 9px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px;">
                    EVALUACIÓN CON BASE EN NMX-F-605-NORMEX / NOM-251-SSA1
                </div>
                <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.4px;">INFORME DE VULNERABILIDAD SANITARIA</h1>
            </div>

            <div style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #d5dde8; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                <div style="color: #0ea5e9; font-weight: 900; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; border-bottom: 1px solid #dfe7f0; padding-bottom: 5px;">Datos del Establecimiento Evaluado</div>
                <div style="font-size: 11px; line-height: 1.6; color: #0f172a;">
                    <div><strong>Empresa / Instalación:</strong> ${quizCompany || 'N/A'}</div>
                    <div><strong>Responsable Técnico:</strong> ${quizName || 'N/A'}</div>
                    <div><strong>Plaza / Ciudad:</strong> ${quizCity || 'N/A'}</div>
                    <div><strong>Teléfono / WhatsApp:</strong> ${quizPhone || 'N/A'}</div>
                    <div><strong>Correo Electrónico:</strong> ${quizEmail || 'No proporcionado'}</div>
                </div>
            </div>

            <div style="display: flex; gap: 12px; margin-bottom: 14px;">
                <div style="flex: 1; background: linear-gradient(180deg, #fff5f5 0%, #fef2f2 100%); border: 1px solid #fecaca; border-radius: 10px; padding: 12px 10px; text-align: center;">
                    <div style="font-size: 9px; font-weight: 900; color: #991b1b; text-transform: uppercase; letter-spacing: 0.6px;">Puntos Críticos (Req. 100%) *</div>
                    <div style="font-size: 30px; font-weight: 900; color: #dc2626; margin: 4px 0 3px; line-height: 1;">${critVal}</div>
                    <div style="font-size: 8.5px; color: #7f1d1d; font-weight: 700;">Cumplimiento Cero Tolerancia</div>
                </div>
                <div style="flex: 1; background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 10px; padding: 12px 10px; text-align: center;">
                    <div style="font-size: 9px; font-weight: 900; color: #075985; text-transform: uppercase; letter-spacing: 0.6px;">Puntos Generales (Req. 90%)</div>
                    <div style="font-size: 30px; font-weight: 900; color: #0284c7; margin: 4px 0 3px; line-height: 1;">${genVal}</div>
                    <div style="font-size: 8.5px; color: #0369a1; font-weight: 700;">Porcentaje Ajustado</div>
                </div>
            </div>

            <div style="background: linear-gradient(180deg, #0f172a 0%, #111827 100%); border-radius: 10px; padding: 10px 12px; text-align: center; font-size: 10px; font-weight: 900; text-transform: uppercase; margin-bottom: 14px; color: #7dd3fc; letter-spacing: 0.6px; border: 1px solid rgba(56, 189, 248, 0.35);">
                ${bannerText}
            </div>

            <div style="background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fcd34d; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                <div style="font-size: 9px; font-weight: 900; color: #92400e; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 5px;">Alcance Normativo</div>
                <p style="font-size: 9.5px; color: #78350f; line-height: 1.5; margin: 0;">
                    Este dictamen representa una evaluación preliminar de carácter informativo. Conforme a las normas <strong>NMX-F-605-NORMEX</strong> y <strong>NOM-251-SSA1</strong>, la validez técnica y legal ante auditorías e inspecciones oficiales requiere forzosamente la verificación física en sitio por parte de personal técnico con Licencia Sanitaria Federal.
                </p>
            </div>

            <div style="background: linear-gradient(180deg, #081d29 0%, #0b2135 100%); border-radius: 10px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(14, 165, 233, 0.35); box-sizing: border-box;">
                <div style="display: flex; align-items: center; justify-content: center; width: 150px; flex-shrink: 0;">
                    ${escudoHtml}
                </div>
                <div style="text-align: center; color: #ffffff; flex: 1; padding: 0 12px;">
                    <div style="font-weight: 900; font-size: 9.5px; letter-spacing: 0.25px; text-transform: uppercase; line-height: 1.4; margin-bottom: 4px;">
                        PROFESIONALES EN SERVICIOS DE CONTROL Y MANEJO DE PLAGAS S DE RL DE CV
                    </div>
                    <div style="width: 42px; height: 2px; background: linear-gradient(90deg, #38bdf8 0%, #0284c7 100%); margin: 4px auto 6px; border-radius: 2px;"></div>
                    <div style="font-size: 8.2px; color: #dbeafe; line-height: 1.5; margin-bottom: 4px;">
                        Licencia Sanitaria Federal COFEPRIS: <strong style="color: #ffffff;">No. 2011-15A023</strong><br>
                        Certificado NMX-F-610-NORMEX: <strong style="color: #ffffff;">No. 013/SDCP/CP</strong>
                    </div>
                    <div style="font-size: 8.1px; color: #7dd3fc; font-weight: 700; letter-spacing: 0.2px;">
                        © 2026 • Todos los derechos reservados • www.procontrolmexico.com
                    </div>
                </div>
                <div style="text-align: center; width: 140px; flex-shrink: 0; display: flex; justify-content: center; align-items: center;">
                    ${qrHtml}
                </div>
            </div>
        </div>
    `;
}

async function ensurePrintableAssetsLoaded() {
    if (!cachedLogoBase64) {
        const logoUrls = [
            './Imagenes/Logo Procontrol Vectores.png',
            'https://crm-procontrol.web.app/Logo%20Procontrol.png',
            'https://raw.githubusercontent.com/gavainc/Procontrol-Mexico/main/Logo%20Procontrol.png',
            'https://gavainc.github.io/Reportes-ProControl/Logo%20Procontrol.png'
        ];
        for (const u of logoUrls) {
            if (cachedLogoBase64) break;
            cachedLogoBase64 = await fetchImageAsBase64(u, 4000);
        }
    }

    if (!cachedEscudoBase64) {
        for (const u of ESCUDO_FALLBACK_URLS) {
            if (cachedEscudoBase64) break;
            cachedEscudoBase64 = await fetchImageAsBase64(u, 1500);
        }
    }

    if (!cachedQrBase64) {
        for (const u of QR_FALLBACK_URLS) {
            if (cachedQrBase64) break;
            cachedQrBase64 = await fetchImageAsBase64(u, 1500);
        }
    }
}

function openPDFPreviewModal() { return; }

function closePDFPreviewModal() {
    const wrapper = document.getElementById('printable-modal-wrapper');
    if (wrapper) wrapper.classList.add('hidden');
}

function executeNativePrint() {
    setTimeout(() => window.print(), 100);
}

async function executeHtml2PdfDownload() {
    await executeDirectPdfDownload();
}

async function waitForImagesToLoad(container) {
    const imgs = [...container.querySelectorAll('img')];
    if (!imgs.length) return;

    await Promise.all(imgs.map(img => new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
        }
        // addEventListener (no onload/onerror=) para no pisar el fallback de URLs
        // que cada <img> ya trae en su atributo onerror inline.
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
    })));
}

async function executeDirectPdfDownload() {
    const overlay = document.getElementById('pdf-loading-overlay');
    if (overlay) overlay.classList.remove('hidden');

    // html2canvas no puede capturar un elemento oculto (display:none):
    // el wrapper se muestra solo para la captura, tapado por el overlay de carga.
    const wrapper = document.getElementById('printable-modal-wrapper');
    const wrapperWasHidden = wrapper ? wrapper.classList.contains('hidden') : false;
    if (wrapper) wrapper.classList.remove('hidden');

    // html2canvas no puede exportar el canvas ni clonar la página bajo file://
    // (SecurityError "tainted canvas" / "file: URLs are unique security origins").
    // Ahí vamos directo a la impresión nativa: funciona sin servidor y de paso
    // deja elegir dónde guardar el PDF.
    const mustUseNativePrint = location.protocol === 'file:';

    try {
        await ensurePrintableAssetsLoaded();

        const contentContainer = document.getElementById('printable-modal-content');
        if (!contentContainer) throw new Error('No existe el contenedor del documento PDF');

        contentContainer.innerHTML = buildOfficialDocumentHTML(cachedLogoBase64, cachedEscudoBase64, cachedQrBase64);
        await waitForImagesToLoad(contentContainer);
        await new Promise((resolve) => setTimeout(resolve, 250));

        if (mustUseNativePrint) {
            if (overlay) overlay.classList.add('hidden');
            window.print(); // bloquea hasta que el usuario cierra el diálogo (Guardar como PDF)
            return;
        }

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `Dictamen_Vulnerabilidad_Sanitaria_${(quizCompany || 'ProControl').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollY: 0,
                scrollX: 0,
                backgroundColor: '#ffffff',
                letterRendering: true
            },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await html2pdf().set(opt).from(contentContainer).output('blob');

        // Deja elegir dónde guardar cuando el navegador lo soporta (Chrome/Edge).
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: opt.filename,
                    types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(pdfBlob);
                await writable.close();
                return;
            } catch (pickerErr) {
                if (pickerErr && pickerErr.name === 'AbortError') return; // el usuario canceló el diálogo
                console.warn('showSaveFilePicker falló, se descarga automáticamente:', pickerErr);
            }
        }

        const pdfUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.rel = 'noopener';
        link.download = opt.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1500);
    } catch (err) {
        console.warn('Fallo html2pdf directo, ejecutando impresión nativa:', err);
        window.print();
    } finally {
        if (wrapper && wrapperWasHidden) wrapper.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');
    }
}
