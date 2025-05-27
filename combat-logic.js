// combat-logic.js
window.gameNS = window.gameNS || {};
window.gameNS.logic = window.gameNS.logic || {};

window.gameNS.fireFriends = true; // Permite ou não fogo amigo

// --- Three.js Death Animation Variables ---
let deathAnimScene, deathAnimCamera, deathAnimRenderer, deathAnimCanvasElement;
let deathAnimPieces = [];
let deathAnimTextureLoader;
let deathAnimRequestID;
let deathAnimCallbackOnEnd;

const DEATH_ANIM_CARD_BASE_WIDTH = 2.5;
const DEATH_ANIM_CARD_BASE_HEIGHT = DEATH_ANIM_CARD_BASE_WIDTH * 1.5;
const DEATH_ANIM_CARD_DEPTH = 0.05;
const DEATH_ANIM_FRAGMENTS_ROWS = 7;
const DEATH_ANIM_FRAGMENTS_COLS = 5;
const GENERIC_CARD_BACK_TEXTURE_URL = 'https://i.imgur.com/Uv2Yqzo.png';
// --- End Three.js Variables ---

window.gameNS.logic._clearCombatVisualsState = function() {
    window.gameNS.isAiming = false;
    window.gameNS.potentialAttackTargets = [];
    if (window.gameNS.logic) {
        window.gameNS.logic._visibleAttackTargets = [];
    }
};

window.gameNS.getUnitsInAttackRange = function(attackerInstanceId, range) {
    const attackerInstance = window.gameNS.placedUnits[attackerInstanceId];
    if (!attackerInstance) {
        console.error("[COMBAT-LOGIC getUnitsInAttackRange] Atacante não encontrado:", attackerInstanceId);
        return [];
    }
    const attackerHex = attackerInstance.currentHex;
    if (!attackerHex) {
         console.error("[COMBAT-LOGIC getUnitsInAttackRange] Coordenada do atacante não definida:", attackerInstanceId);
         return [];
    }
    const attackerCountry = attackerInstance.PAÍS;
    const hexesInAttackRadius = window.gameNS.getHexesInDistance ? window.gameNS.getHexesInDistance(attackerHex, range) : [];
    const validTargets = [];

    for (const hexCoord of hexesInAttackRadius) {
        if (hexCoord === attackerHex) continue;
        const targetInstanceIdOnHex = window.gameNS.getUnitOnHex ? window.gameNS.getUnitOnHex(hexCoord) : null;
        if (!targetInstanceIdOnHex) continue;
        const targetInstance = window.gameNS.placedUnits[targetInstanceIdOnHex];
        if (!targetInstance) continue;
        const isSameCountry = attackerCountry === targetInstance.PAÍS;
        if (window.gameNS.fireFriends || !isSameCountry) {
             validTargets.push(targetInstanceIdOnHex);
        }
    }
    return validTargets;
};

window.gameNS.logic.showAttackOptionsForUnit = function(selectedUnitInstanceId) {
    if (!window.gameNS.activeUnitForAction || window.gameNS.activeUnitForAction.unitIdKey !== selectedUnitInstanceId) {
         console.warn("[COMBAT showAttackOptions] Unidade selecionada não é a unidade ativa para ação. Limpando.");
         window.gameNS.clearActionHighlights?.();
         window.gameNS.clearUnitInfo?.();
         return;
    }

    const attackerContext = window.gameNS.activeUnitForAction;
    const attackerInstance = attackerContext.unitInstanceData;
    const attackerBaseData = window.gameNS.cardProperties[attackerContext.originalUnitIdKey];

    if (!attackerInstance || !attackerBaseData) {
        console.error("[COMBAT showAttackOptions] Dados do atacante (instância ou base) não encontrados.");
        window.gameNS.clearActionHighlights?.();
        window.gameNS.clearUnitInfo?.();
        return;
    }

    const isPlayersUnit = attackerInstance.PAÍS === window.gameNS.gameState.currentPlayerCountry;
    const canAttackBase = parseInt(attackerBaseData["PODER DE FOGO"] || 0) > 0;
    const hasAttacked = attackerInstance.hasAttackedThisTurn || false;
    const currentAttackRange = parseInt(attackerInstance.currentAlcance || 0);

    if (!isPlayersUnit || !canAttackBase || hasAttacked || currentAttackRange <= 0) {
         console.log(`[COMBAT showAttackOptions] Condições para ataque não atendidas para ${selectedUnitInstanceId}. IsPlayer: ${isPlayersUnit}, CanAttackBase: ${canAttackBase}, HasAttacked: ${hasAttacked}, Range: ${currentAttackRange}`);
         window.gameNS.clearActionHighlights?.();
         return;
    }

    window.gameNS.isAiming = true;
    window.gameNS.potentialAttackTargets = window.gameNS.getUnitsInAttackRange(selectedUnitInstanceId, currentAttackRange);

    if (window.gameNS.potentialAttackTargets.length === 0) {
        return;
    }

    if (window.gameNS.logic) window.gameNS.logic._visibleAttackTargets = [];

    window.gameNS.potentialAttackTargets.forEach(targetId => {
        if (window.gameNS.logic && typeof window.gameNS.logic._placeTargetIconOnUnit === 'function') {
            window.gameNS.logic._placeTargetIconOnUnit(targetId, selectedUnitInstanceId);
            if (window.gameNS.logic._visibleAttackTargets) window.gameNS.logic._visibleAttackTargets.push(targetId);
        }
    });
};

window.gameNS.logic._placeTargetIconOnUnit = function(targetInstanceId, attackerInstanceId) {
    const targetInstance = window.gameNS.placedUnits[targetInstanceId];
    if (!targetInstance || !targetInstance.currentHex) {
        console.warn(`[COMBAT _placeTargetIcon] Alvo ${targetInstanceId} ou sua coordenada não encontrados.`);
        return;
    }

    const hexSvg = window.gameNS.utils.getHexagonSvgByCoord?.(targetInstance.currentHex);
    const hexContentOverlay = hexSvg?.closest('.hexagon-wrapper')?.querySelector('.hexagon-content-overlay');

    if (hexContentOverlay) {
        hexContentOverlay.querySelectorAll('.attack-target-icon').forEach(icon => icon.remove());
        const targetIcon = document.createElement('img');
        targetIcon.src = 'Img/icones/svg/mira.svg';
        targetIcon.alt = 'Alvo de Ataque';
        targetIcon.className = 'attack-target-icon';
        targetIcon.dataset.targetId = targetInstanceId;
        targetIcon.dataset.attackerId = attackerInstanceId;

        targetIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            const currentTargetId = event.currentTarget.dataset.targetId;
            const currentAttackerId = event.currentTarget.dataset.attackerId;

            if (!window.gameNS.activeUnitForAction || window.gameNS.activeUnitForAction.unitIdKey !== currentAttackerId) {
                 alert("Erro: A unidade ativa mudou. Cancele a ação atual e tente novamente.");
                 window.gameNS.cancelAimingMode?.(); return;
            }
            const attacker = window.gameNS.placedUnits[currentAttackerId];
            if (!attacker || attacker.hasAttackedThisTurn) {
                alert(attacker ? "Esta unidade já atacou neste turno." : "Erro: Atacante não encontrado.");
                window.gameNS.cancelAimingMode?.(); return;
            }
            if (!window.gameNS.potentialAttackTargets || !window.gameNS.potentialAttackTargets.includes(currentTargetId)) {
                 alert("Alvo inválido ou fora de alcance.");
                 window.gameNS.cancelAimingMode?.(); return;
            }
            const target = window.gameNS.placedUnits[currentTargetId];
            if (!target) {
                 alert(`Alvo (ID: ${currentTargetId}) não existe mais!`);
                 window.gameNS.cancelAimingMode?.(); return;
            }
            if (typeof window.gameNS.executeAttack === 'function') {
                window.gameNS.executeAttack(currentAttackerId, currentTargetId);
            } else {
                console.error("Função executeAttack não definida globalmente em window.gameNS!");
                window.gameNS.cancelAimingMode?.();
            }
        });
        hexContentOverlay.appendChild(targetIcon);
    } else {
        console.warn(`[COMBAT _placeTargetIcon] Overlay de conteúdo não encontrado para o hex ${targetInstance.currentHex}`);
    }
};

function performUnitDataDestruction(targetInstanceId, baseTargetData, attackerInstanceId) {
    const targetName = baseTargetData?.NOME || window.gameNS.placedUnits[targetInstanceId]?.NOME || targetInstanceId;
    const targetCountry = baseTargetData?.PAÍS; // Pega o país do alvo dos dados base

    console.log(`%c[COMBAT performUnitDataDestruction] Removendo dados para ${targetInstanceId} (${targetName}) do país ${targetCountry}.`, 'color: red;');

    delete window.gameNS.placedUnits[targetInstanceId];

    if (window.gameNS.activeUnitForAction?.unitIdKey === targetInstanceId) {
        console.log(`[COMBAT performUnitDataDestruction] A unidade ativa (${targetInstanceId}) foi destruída. Limpando UI.`);
        window.gameNS.clearUnitInfo?.();
    }

    // --- VERIFICAÇÃO DA CONDIÇÃO DE VITÓRIA ---
    if (window.gameNS.gameState.gameMode === "Versus Local" && !window.gameNS.gameState.isGameOver) {
        // Use a propriedade que você definiu para identificar QGs, ex: CATEGORIA, TIPO ou isCommandCenter
        const wasCommandCenter = baseTargetData?.CATEGORIA === "Q.G"; // OU baseTargetData?.TIPO === "QG" OU baseTargetData?.isCommandCenter === true

        if (wasCommandCenter) {
            console.log(`%c[VITÓRIA] Unidade com CATEGORIA "Q.G" (${targetName} de ${targetCountry}) destruída!`, "color: gold; font-weight: bold;");
            
            let winnerName = "Jogador Desconhecido";
            let winnerCountry = "País Desconhecido";
            let attackerCountryFound = null;

            const attacker = window.gameNS.placedUnits[attackerInstanceId]; // O atacante ainda deve existir neste ponto
            if (attacker && attacker.PAÍS) {
                attackerCountryFound = attacker.PAÍS;
            }
            // Caso o atacante seja destruído por um contra-ataque simultâneo (não implementado ainda, mas por segurança)
            else if (window.gameNS.gameState.activeUnitForAction && 
                     window.gameNS.gameState.activeUnitForAction.unitInstanceData && 
                     window.gameNS.gameState.activeUnitForAction.unitIdKey === attackerInstanceId) {
                 attackerCountryFound = window.gameNS.gameState.activeUnitForAction.unitInstanceData.PAÍS;
            }


            if (attackerCountryFound && attackerCountryFound !== targetCountry) {
                winnerCountry = attackerCountryFound;
                if (winnerCountry === window.gameNS.gameState.player1Country) {
                    winnerName = window.gameNS.gameState.player1Name;
                } else if (winnerCountry === window.gameNS.gameState.player2Country) {
                    winnerName = window.gameNS.gameState.player2Name;
                } else {
                     winnerName = `Jogador de ${winnerCountry}`;
                }
            } else if (!attackerCountryFound || attackerCountryFound === targetCountry) { // Fogo amigo no QG ou atacante desconhecido
                if (targetCountry === window.gameNS.gameState.player1Country) {
                    winnerName = window.gameNS.gameState.player2Name;
                    winnerCountry = window.gameNS.gameState.player2Country;
                } else if (targetCountry === window.gameNS.gameState.player2Country) {
                    winnerName = window.gameNS.gameState.player1Name;
                    winnerCountry = window.gameNS.gameState.player1Country;
                } else {
                    console.warn("QG destruído de um país não participante no modo Versus Local.");
                     window.gameNS.endGameWithResult?.("EMPATE", `Um QG de ${targetCountry} foi destruído de forma inesperada!`);
                    return;
                }
            }
            
            window.gameNS.endGameWithResult?.(winnerName, `O Centro de Comando de ${targetCountry} foi destruído! ${winnerName} (${winnerCountry}) venceu!`);
        }
    }
}

// --- Funções de Animação de Morte com Three.js ---
function initDeathAnimationScene() {
    if (deathAnimCanvasElement && deathAnimRenderer) return true;
    deathAnimCanvasElement = document.getElementById('deathAnimationCanvas');
    if (!deathAnimCanvasElement) {
        console.error("Canvas para animação de morte ('deathAnimationCanvas') não encontrado!");
        return false;
    }
    deathAnimScene = new THREE.Scene();
    deathAnimCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    deathAnimCamera.position.z = 4;
    deathAnimRenderer = new THREE.WebGLRenderer({ canvas: deathAnimCanvasElement, antialias: true, alpha: true });
    deathAnimRenderer.setSize(window.innerWidth, window.innerHeight);
    deathAnimRenderer.setPixelRatio(window.devicePixelRatio);
    deathAnimRenderer.setClearColor(0x000000, 0);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    deathAnimScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 5, 5);
    deathAnimScene.add(directionalLight);
    deathAnimTextureLoader = new THREE.TextureLoader();
    console.log("Three.js death animation scene initialized.");
    return true;
}

function createExplosionFragments(textureFrenteSrc, textureVersoSrc) {
    if (!deathAnimScene || !deathAnimTextureLoader) {
        console.error("Cena de animação de morte não inicializada para createExplosionFragments.");
        if (deathAnimCallbackOnEnd) deathAnimCallbackOnEnd();
        return;
    }
    deathAnimPieces.forEach(p => deathAnimScene.remove(p.mesh));
    deathAnimPieces = [];

    const onFrenteLoad = (textureFrente) => {
        textureFrente.colorSpace = THREE.SRGBColorSpace;
        const onVersoLoad = (textureVerso) => {
            textureVerso.colorSpace = THREE.SRGBColorSpace;
            const pieceW = DEATH_ANIM_CARD_BASE_WIDTH / DEATH_ANIM_FRAGMENTS_COLS;
            const pieceH = DEATH_ANIM_CARD_BASE_HEIGHT / DEATH_ANIM_FRAGMENTS_ROWS;

            for (let i = 0; i < DEATH_ANIM_FRAGMENTS_ROWS; i++) {
                for (let j = 0; j < DEATH_ANIM_FRAGMENTS_COLS; j++) {
                    const u = j / DEATH_ANIM_FRAGMENTS_COLS;
                    const v = 1 - (i + 1) / DEATH_ANIM_FRAGMENTS_ROWS;
                    const uW = 1 / DEATH_ANIM_FRAGMENTS_COLS;
                    const vH = 1 / DEATH_ANIM_FRAGMENTS_ROWS;

                    const matFrente = new THREE.MeshStandardMaterial({ map: textureFrente.clone(), roughness: 0.7, metalness: 0.1, side: THREE.FrontSide });
                    matFrente.map.offset.set(u, v);
                    matFrente.map.repeat.set(uW, vH);
                    matFrente.map.needsUpdate = true;

                    const matVerso = new THREE.MeshStandardMaterial({ map: textureVerso.clone(), roughness: 0.7, metalness: 0.1, side: THREE.FrontSide });
                    matVerso.map.offset.set(u,v);
                    matVerso.map.repeat.set(uW,vH);
                    matVerso.map.needsUpdate = true;

                    const materials = [
                        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.2 }),
                        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.2 }),
                        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.2 }),
                        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.2 }),
                        matFrente,
                        matVerso
                    ];
                    const geo = new THREE.BoxGeometry(pieceW, pieceH, DEATH_ANIM_CARD_DEPTH);
                    const mesh = new THREE.Mesh(geo, materials);
                    mesh.position.x = (j * pieceW) - (DEATH_ANIM_CARD_BASE_WIDTH / 2) + (pieceW / 2);
                    mesh.position.y = (i * pieceH) - (DEATH_ANIM_CARD_BASE_HEIGHT / 2) + (pieceH / 2);
                    const dir = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.2) * 1.5).normalize();
                    const speed = 0.03 + Math.random() * 0.07;
                    const velocity = dir.multiplyScalar(speed);
                    const angularVelocity = new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
                    deathAnimScene.add(mesh);
                    deathAnimPieces.push({ mesh, velocity, angularVelocity, life: 120 + Math.random() * 60 });
                }
            }
            if (deathAnimPieces.length > 0) {
                animateDeathExplosion();
            } else if (deathAnimCallbackOnEnd) {
                deathAnimCallbackOnEnd();
            }
        };
        const onVersoError = () => {
            console.warn("Falha ao carregar textura do verso para explosão 3D, usando cor sólida.");
            const colorArray = new Uint8Array(3); colorArray[0]=80; colorArray[1]=80; colorArray[2]=80;
            const colorTexture = new THREE.DataTexture(colorArray, 1, 1, THREE.RGBFormat);
            colorTexture.needsUpdate = true;
            onVersoLoad(colorTexture);
        };
        deathAnimTextureLoader.load(textureVersoSrc, onVersoLoad, undefined, onVersoError);
    };
    const onFrenteError = () => {
        console.error("Falha CRÍTICA ao carregar textura da frente da unidade para explosão 3D!");
        if (deathAnimCallbackOnEnd) deathAnimCallbackOnEnd();
        cleanupDeathAnimation();
    };
    deathAnimTextureLoader.load(textureFrenteSrc, onFrenteLoad, undefined, onFrenteError);
}

function animateDeathExplosion() {
    deathAnimRequestID = requestAnimationFrame(animateDeathExplosion);
    let allPiecesEffectivelyGone = true;
    for (let i = deathAnimPieces.length - 1; i >= 0; i--) {
        const piece = deathAnimPieces[i];
        if (piece.mesh.parent) {
            allPiecesEffectivelyGone = false;
            piece.mesh.position.add(piece.velocity);
            piece.mesh.rotation.x += piece.angularVelocity.x;
            piece.mesh.rotation.y += piece.angularVelocity.y;
            piece.mesh.rotation.z += piece.angularVelocity.z;
            piece.velocity.multiplyScalar(0.97);
            piece.life--;
            if (piece.life <= 0 || piece.mesh.position.lengthSq() > 1000) {
                deathAnimScene.remove(piece.mesh);
            }
        }
    }
    deathAnimPieces = deathAnimPieces.filter(p => p.mesh.parent);
    if (deathAnimPieces.length === 0 && !allPiecesEffectivelyGone) {
         allPiecesEffectivelyGone = true;
    }
    if (allPiecesEffectivelyGone && deathAnimPieces.length === 0) {
        cleanupDeathAnimation();
        if (deathAnimCallbackOnEnd) {
            deathAnimCallbackOnEnd();
            deathAnimCallbackOnEnd = null;
        }
    }
    if (deathAnimRenderer && deathAnimScene && deathAnimCamera) {
      deathAnimRenderer.render(deathAnimScene, deathAnimCamera);
    }
}

function cleanupDeathAnimation() {
    if (deathAnimRequestID) cancelAnimationFrame(deathAnimRequestID);
    deathAnimRequestID = null;
    if (deathAnimCanvasElement) deathAnimCanvasElement.style.display = 'none';
    if (deathAnimScene) {
        while(deathAnimScene.children.length > 0){
            const child = deathAnimScene.children[0];
            deathAnimScene.remove(child);
            if(child.geometry) child.geometry.dispose();
            if(child.material){
                if(Array.isArray(child.material)){
                    child.material.forEach(m => {
                        if(m.map) m.map.dispose();
                        m.dispose();
                    });
                } else {
                    if(child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        }
    }
    deathAnimPieces = [];
}

function startCardExplosionAnimation(unitImageSrc, callback) {
    if (!window.gameNS.settings.animationsEnabled) {
        console.log("[COMBAT startCardExplosion] Animações desabilitadas. Pulando explosão 3D.");
        if (callback) callback();
        return;
    }
    if (!initDeathAnimationScene()) {
        console.error("Falha ao inicializar a cena da animação de morte 3D. Abortando explosão.");
        if (callback) callback();
        return;
    }
    deathAnimCallbackOnEnd = callback;
    if (deathAnimCanvasElement) deathAnimCanvasElement.style.display = 'block';
    createExplosionFragments(unitImageSrc, GENERIC_CARD_BACK_TEXTURE_URL);
}

window.gameNS.executeAttack = function(attackerInstanceId, targetInstanceId) {
    console.log(`%c[COMBAT executeAttack] Iniciando: ${attackerInstanceId} -> ${targetInstanceId}`, 'color: orange;');
    const attackerInstance = window.gameNS.placedUnits[attackerInstanceId];
    const targetInstance = window.gameNS.placedUnits[targetInstanceId];

    if (!attackerInstance || !targetInstance) { console.error("[COMBAT executeAttack] Atacante ou alvo inválido."); window.gameNS.cancelAimingMode?.(); return false; }
    const baseAttackerData = window.gameNS.cardProperties[attackerInstance.originalUnitIdKey];
    const baseTargetData = window.gameNS.cardProperties[targetInstance.originalUnitIdKey];
    if (!baseAttackerData || !baseTargetData) { console.error("[COMBAT executeAttack] Dados base do atacante ou alvo não encontrados."); window.gameNS.cancelAimingMode?.(); return false; }
    if (attackerInstance.hasAttackedThisTurn) { console.warn("[COMBAT executeAttack] Atacante já atacou neste turno."); window.gameNS.cancelAimingMode?.(); return false; }
    if (!window.gameNS.placedUnits[targetInstanceId]) { alert(`Alvo não existe mais! (ID: ${targetInstanceId})`); window.gameNS.cancelAimingMode?.(); return false; }

    const attackerHexCoord = attackerInstance.currentHex;
    const targetHexCoord = targetInstance.currentHex;
    const currentDistance = typeof window.gameNS.calculateDistance === 'function' ? window.gameNS.calculateDistance(attackerHexCoord, targetHexCoord) : Infinity;
    const attackerCurrentRange = parseInt(attackerInstance.currentAlcance || 0);

    if (currentDistance > attackerCurrentRange) { alert(`Alvo fora de alcance! Dist: ${currentDistance}, Alcance da unidade: ${attackerCurrentRange}`); window.gameNS.cancelAimingMode?.(); return false; }
    const isSameCountryAttack = attackerInstance.PAÍS === targetInstance.PAÍS;
    if (isSameCountryAttack && !window.gameNS.fireFriends) { alert(`Fogo amigo desativado. Não pode atacar unidades do mesmo país (${attackerInstance.PAÍS}).`); window.gameNS.cancelAimingMode?.(); return false; }

    const damageDealt = parseInt(baseAttackerData["PODER DE FOGO"] || 0);
    window.gameNS.placedUnits[targetInstanceId].currentBlindagem -= damageDealt;
    let newBlindagem = window.gameNS.placedUnits[targetInstanceId].currentBlindagem;
    console.log(`%c[COMBAT executeAttack] ${attackerInstance.NOME || baseAttackerData.NOME} ataca ${targetInstance.NOME || baseTargetData.NOME} com ${damageDealt} de dano. Blindagem restante: ${newBlindagem}`, 'color: orange;');
    
    const handlePostDestructionLogicWrapper = (currentAttackerBaseData, currentTargetOriginalKey, destroyedInstanceId, attackerIdForVictoryCheck) => {
        const attackerName = currentAttackerBaseData.NOME;
        const attackerCategory = currentAttackerBaseData.CATEGORIA;
        let videoPath = null;
        const isTropaType = (window.gameNS.unitMovementTypesMap && window.gameNS.unitMovementTypesMap[attackerCategory] === "Tropa") ||
                            attackerCategory.toLowerCase().includes("tropa") ||
                            attackerCategory.toLowerCase().includes("infantaria") ||
                            attackerCategory.toLowerCase().includes("comando") ||
                            attackerCategory.toLowerCase().includes("pqd");
        if (isTropaType) {
            if (window.gameNS.destructionVideos && window.gameNS.destructionVideos[attackerName]) { videoPath = window.gameNS.destructionVideos[attackerName]; }
            else if (window.gameNS.destructionVideos && window.gameNS.destructionVideos["GENERIC_TROPA"]) { videoPath = window.gameNS.destructionVideos["GENERIC_TROPA"];}
        }
        if (!videoPath && window.gameNS.destructionVideos && window.gameNS.destructionVideos[attackerCategory]) { videoPath = window.gameNS.destructionVideos[attackerCategory];}
        if (!videoPath && window.gameNS.destructionVideos && window.gameNS.destructionVideos["DEFAULT"]) { videoPath = window.gameNS.destructionVideos["DEFAULT"]; }

        if (videoPath && window.gameNS.settings.animationsEnabled) { // Só mostra vídeo se animações estiverem habilitadas
            if (window.gameNS.ui && typeof window.gameNS.ui.showDestructionVideo === 'function') { window.gameNS.ui.showDestructionVideo(videoPath); }
        } else {
            if (window.gameNS.ui && typeof window.gameNS.ui.resetDestructionVideoArea === 'function') { window.gameNS.ui.resetDestructionVideoArea(); }
        }
        
        // É crucial chamar performUnitDataDestruction ANTES de tentar marcar o atacante,
        // pois performUnitDataDestruction pode finalizar o jogo.
        performUnitDataDestruction(destroyedInstanceId, window.gameNS.cardProperties[currentTargetOriginalKey], attackerIdForVictoryCheck);
        
        // Só continua se o jogo não acabou
        if (window.gameNS.gameState && !window.gameNS.gameState.isGameOver) {
            if (window.gameNS.placedUnits[attackerIdForVictoryCheck]) {
                window.gameNS.placedUnits[attackerIdForVictoryCheck].hasAttackedThisTurn = true;
            }
            window.gameNS.cancelAimingMode?.();
        }
    };

    if (newBlindagem <= 0) {
        const targetTokenElement = document.querySelector(`.unit-map-token[data-token-id='${targetInstanceId}']`);
        const unitImageElementOriginal = targetTokenElement ? targetTokenElement.querySelector('img') : null;

        if (window.gameNS.settings.animationsEnabled && targetTokenElement && unitImageElementOriginal) {
            const originalRect = targetTokenElement.getBoundingClientRect();
            const animToken2D = targetTokenElement.cloneNode(true);
            animToken2D.id = `anim-2d-death-${targetInstanceId}`;
            animToken2D.style.pointerEvents = 'none';
            targetTokenElement.style.visibility = 'hidden';
            animToken2D.classList.add('unit-token-death-animation');
            animToken2D.style.width = `${originalRect.width}px`;
            animToken2D.style.height = `${originalRect.height}px`;
            animToken2D.style.top = `${originalRect.top}px`;
            animToken2D.style.left = `${originalRect.left}px`;
            animToken2D.style.transform = '';
            document.body.appendChild(animToken2D);
            void animToken2D.offsetWidth;
            animToken2D.classList.add('unit-token-grown-centered');
            const targetHeightVh = 80;
            const screenHeight = window.innerHeight;
            const targetPixelHeight = (screenHeight * targetHeightVh) / 100;
            let targetPixelWidth = targetPixelHeight;
            const imgInClone2D = animToken2D.querySelector('img');
            if (imgInClone2D && imgInClone2D.naturalWidth > 0 && imgInClone2D.naturalHeight > 0) {
                const aspectRatio = imgInClone2D.naturalWidth / imgInClone2D.naturalHeight;
                targetPixelWidth = targetPixelHeight * aspectRatio;
            } else if (originalRect.width > 0 && originalRect.height > 0) {
                const aspectRatio = originalRect.width / originalRect.height;
                targetPixelWidth = targetPixelHeight * aspectRatio;
            }
            animToken2D.style.height = `${targetPixelHeight}px`;
            animToken2D.style.width = `${targetPixelWidth}px`;
            let growthAnimationCompleted = false;
            const on2DGrowAnimationEnd = function(event) {
                if (event.target === animToken2D && (event.propertyName === 'height' || event.propertyName === 'transform' || event.propertyName === 'width')) {
                    if (growthAnimationCompleted) return;
                    growthAnimationCompleted = true;
                    animToken2D.removeEventListener('transitionend', on2DGrowAnimationEnd);
                    const pauseDuration = 2000;
                    setTimeout(() => {
                        animToken2D.style.display = 'none';
                        const unitOriginalImageSrc = unitImageElementOriginal.src;
                        startCardExplosionAnimation(unitOriginalImageSrc, () => {
                            if (animToken2D.parentNode) animToken2D.parentNode.removeChild(animToken2D);
                            if (targetTokenElement && targetTokenElement.parentNode) targetTokenElement.parentNode.removeChild(targetTokenElement);
                            handlePostDestructionLogicWrapper(baseAttackerData, targetInstance.originalUnitIdKey, targetInstanceId, attackerInstanceId);
                        });
                    }, pauseDuration);
                }
            };
            animToken2D.addEventListener('transitionend', on2DGrowAnimationEnd);
        } else {
            if (targetTokenElement) {
                if (typeof targetTokenElement.classList?.add === 'function') {
                    targetTokenElement.classList.add('unit-token-destroyed');
                    setTimeout(() => { if (targetTokenElement.parentNode) targetTokenElement.parentNode.removeChild(targetTokenElement); }, 500);
                } else if (targetTokenElement.parentNode) { targetTokenElement.parentNode.removeChild(targetTokenElement); }
            }
            handlePostDestructionLogicWrapper(baseAttackerData, targetInstance.originalUnitIdKey, targetInstanceId, attackerInstanceId);
        }
    } else {
        console.log(`%c[COMBAT executeAttack] Alvo ${targetInstanceId} danificado. Blindagem restante: ${newBlindagem}`, 'color: yellow;');
        if (damageDealt > 0 && !targetInstance.isDamaged) {
            window.gameNS.placedUnits[targetInstanceId].isDamaged = true;
            const originalMovimento = parseInt(baseTargetData.DESLOCAMENTO) || 0;
            const originalAlcance = parseInt(baseTargetData.ALCANCE) || 0;
            window.gameNS.placedUnits[targetInstanceId].currentMovimento = Math.floor(originalMovimento / 2);
            window.gameNS.placedUnits[targetInstanceId].currentAlcance = Math.floor(originalAlcance / 2);
            const damagedTokenElement = document.querySelector(`.unit-map-token[data-token-id='${targetInstanceId}']`);
            if(damagedTokenElement) damagedTokenElement.classList.add('is-damaged');
        }
        if (window.gameNS.activeUnitForAction?.unitIdKey === targetInstanceId) {
            window.gameNS.populateUnitInfo?.(targetInstanceId, true);
        }
        window.gameNS.placedUnits[attackerInstanceId].hasAttackedThisTurn = true;
        if (window.gameNS.gameState && !window.gameNS.gameState.isGameOver) { // Só cancela se o jogo não acabou
            window.gameNS.cancelAimingMode?.();
        }
    }
    return true;
};

window.gameNS.cancelAimingMode = function() {
    window.gameNS.logic._clearCombatVisualsState();
    window.gameNS.clearActionHighlights?.();
    if (window.gameNS.activeUnitForAction?.unitIdKey && window.gameNS.placedUnits[window.gameNS.activeUnitForAction.unitIdKey]) {
        window.gameNS.populateUnitInfo?.(window.gameNS.activeUnitForAction.unitIdKey, true);
    } else if (window.gameNS.activeUnitForAction && !window.gameNS.placedUnits[window.gameNS.activeUnitForAction.unitIdKey]) {
        window.gameNS.clearUnitInfo?.();
    } else {
         window.gameNS.clearUnitInfo?.();
    }
};

window.addEventListener('resize', () => {
    if (deathAnimCamera && deathAnimRenderer && deathAnimCanvasElement && deathAnimCanvasElement.style.display !== 'none') {
        deathAnimCamera.aspect = window.innerWidth / window.innerHeight;
        deathAnimCamera.updateProjectionMatrix();
        deathAnimRenderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// combat-logic.js
// ... other code ...

function performUnitDataDestruction(targetInstanceId, baseTargetData, attackerInstanceId) {
    const targetName = baseTargetData?.NOME || window.gameNS.placedUnits[targetInstanceId]?.NOME || targetInstanceId;
    const targetCountry = baseTargetData?.PAÍS; // Pega o país do alvo dos dados base

    console.log(`%c[COMBAT performUnitDataDestruction] Removendo dados para ${targetInstanceId} (${targetName}) do país ${targetCountry}.`, 'color: red;');

    // It's important to get data related to the target BEFORE deleting it.
    const wasCommandCenter = baseTargetData?.CATEGORIA === "Q.G"; // OU baseTargetData?.TIPO === "QG" OU baseTargetData?.isCommandCenter === true

    delete window.gameNS.placedUnits[targetInstanceId];

    if (window.gameNS.activeUnitForAction?.unitIdKey === targetInstanceId) {
        console.log(`[COMBAT performUnitDataDestruction] A unidade ativa (${targetInstanceId}) foi destruída. Limpando UI.`);
        window.gameNS.clearUnitInfo?.();
    }

    // --- VERIFICAÇÃO DA CONDIÇÃO DE VITÓRIA ---
    // Moved the check after deletion but using pre-deletion data (wasCommandCenter, targetCountry, targetName)
    if (window.gameNS.gameState.gameMode === "Versus Local" && !window.gameNS.gameState.isGameOver) {
        if (wasCommandCenter) {
            console.log(`%c[VITÓRIA] Unidade com CATEGORIA "Q.G." (${targetName} de ${targetCountry}) destruída!`, "color: gold; font-weight: bold;");
            
            let winnerPlayerName = "Jogador Desconhecido";
            let winningCountry = "País Desconhecido";
            let losingCountry = targetCountry || "País Desconhecido"; // The country of the destroyed QG is the loser
            let attackerCountryFound = null;

            const attacker = window.gameNS.placedUnits[attackerInstanceId]; 
            if (attacker && attacker.PAÍS) {
                attackerCountryFound = attacker.PAÍS;
            } else if (window.gameNS.activeUnitForAction && 
                     window.gameNS.activeUnitForAction.unitInstanceData && 
                     window.gameNS.activeUnitForAction.unitIdKey === attackerInstanceId) {
                 // Fallback if attacker was somehow removed but was the active unit
                 attackerCountryFound = window.gameNS.activeUnitForAction.unitInstanceData.PAÍS;
            }

            if (attackerCountryFound && attackerCountryFound !== targetCountry) { // Standard win: attacker's country is different from QG's country
                winningCountry = attackerCountryFound;
                if (winningCountry === window.gameNS.gameState.player1Country) {
                    winnerPlayerName = window.gameNS.gameState.player1Name;
                } else if (winningCountry === window.gameNS.gameState.player2Country) {
                    winnerPlayerName = window.gameNS.gameState.player2Name;
                } else {
                     winnerPlayerName = `Jogador de ${winningCountry}`; // Should not happen in 2-player versus
                }
            } else { // Friendly fire on QG, or attacker is unknown/same country (implies other player wins)
                if (targetCountry === window.gameNS.gameState.player1Country) { // P1's QG destroyed
                    winnerPlayerName = window.gameNS.gameState.player2Name;
                    winningCountry = window.gameNS.gameState.player2Country;
                } else if (targetCountry === window.gameNS.gameState.player2Country) { // P2's QG destroyed
                    winnerPlayerName = window.gameNS.gameState.player1Name;
                    winningCountry = window.gameNS.gameState.player1Country;
                } else {
                    // This case should ideally not be reached if player countries are set correctly
                    console.warn("QG destruído de um país não participante no modo Versus Local ou lógica de vencedor ambígua.");
                    // Fallback to a draw or error state if necessary, but the logic above should cover P1/P2.
                    // For now, let's assume one of the players must be the winner.
                    // If targetCountry is not P1 or P2, then it's an error in game setup.
                    window.gameNS.endGameWithResult?.("EMPATE", "País Desconhecido", "País Desconhecido", `Um QG (${targetName} de ${targetCountry}) foi destruído de forma inesperada!`, "QG_DESTRUCTION_ERROR");
                    return;
                }
            }
            
            const specificEventMessage = `O Centro de Comando de ${losingCountry} foi destruído! ${winnerPlayerName} (${winningCountry}) venceu!`;
            console.log(`%c[FIM DE JOGO] ${specificEventMessage}`, "color: gold; font-size: 1.2em;");
            
            // Call with: winnerPlayerName, winningCountry, losingCountry, specificMessageForLog, reason
            window.gameNS.endGameWithResult?.(winnerPlayerName, winningCountry, losingCountry, specificEventMessage, "QG_DESTRUCTION");
        }
    }
}

// ... other combat-logic.js code ...

// Ensure executeAttack function checks for isGameOver
window.gameNS.executeAttack = function(attackerInstanceId, targetInstanceId) {
    if (window.gameNS.gameState && window.gameNS.gameState.isGameOver) {
        alert("O jogo já terminou. Não é possível atacar.");
        window.gameNS.cancelAimingMode?.();
        return false;
    }
    // ... rest of the executeAttack function ...
    console.log(`%c[COMBAT executeAttack] Iniciando: ${attackerInstanceId} -> ${targetInstanceId}`, 'color: orange;');
    const attackerInstance = window.gameNS.placedUnits[attackerInstanceId];
    const targetInstance = window.gameNS.placedUnits[targetInstanceId];

    if (!attackerInstance || !targetInstance) { console.error("[COMBAT executeAttack] Atacante ou alvo inválido."); window.gameNS.cancelAimingMode?.(); return false; }
    const baseAttackerData = window.gameNS.cardProperties[attackerInstance.originalUnitIdKey];
    const baseTargetData = window.gameNS.cardProperties[targetInstance.originalUnitIdKey];
    if (!baseAttackerData || !baseTargetData) { console.error("[COMBAT executeAttack] Dados base do atacante ou alvo não encontrados."); window.gameNS.cancelAimingMode?.(); return false; }
    if (attackerInstance.hasAttackedThisTurn) { console.warn("[COMBAT executeAttack] Atacante já atacou neste turno."); window.gameNS.cancelAimingMode?.(); return false; }
    if (!window.gameNS.placedUnits[targetInstanceId]) { alert(`Alvo não existe mais! (ID: ${targetInstanceId})`); window.gameNS.cancelAimingMode?.(); return false; }

    const attackerHexCoord = attackerInstance.currentHex;
    const targetHexCoord = targetInstance.currentHex;
    const currentDistance = typeof window.gameNS.calculateDistance === 'function' ? window.gameNS.calculateDistance(attackerHexCoord, targetHexCoord) : Infinity;
    const attackerCurrentRange = parseInt(attackerInstance.currentAlcance || 0);

    if (currentDistance > attackerCurrentRange) { alert(`Alvo fora de alcance! Dist: ${currentDistance}, Alcance da unidade: ${attackerCurrentRange}`); window.gameNS.cancelAimingMode?.(); return false; }
    const isSameCountryAttack = attackerInstance.PAÍS === targetInstance.PAÍS;
    if (isSameCountryAttack && !window.gameNS.fireFriends) { alert(`Fogo amigo desativado. Não pode atacar unidades do mesmo país (${attackerInstance.PAÍS}).`); window.gameNS.cancelAimingMode?.(); return false; }

    const damageDealt = parseInt(baseAttackerData["PODER DE FOGO"] || 0);
    window.gameNS.placedUnits[targetInstanceId].currentBlindagem -= damageDealt;
    let newBlindagem = window.gameNS.placedUnits[targetInstanceId].currentBlindagem;
    console.log(`%c[COMBAT executeAttack] ${attackerInstance.NOME || baseAttackerData.NOME} ataca ${targetInstance.NOME || baseTargetData.NOME} com ${damageDealt} de dano. Blindagem restante: ${newBlindagem}`, 'color: orange;');
    
    const handlePostDestructionLogicWrapper = (currentAttackerBaseData, currentTargetOriginalKey, destroyedInstanceId, attackerIdForVictoryCheck) => {
        const attackerName = currentAttackerBaseData.NOME;
        const attackerCategory = currentAttackerBaseData.CATEGORIA;
        let videoPath = null;
        const isTropaType = (window.gameNS.unitMovementTypesMap && window.gameNS.unitMovementTypesMap[attackerCategory] === "Tropa") ||
                            attackerCategory.toLowerCase().includes("tropa") ||
                            attackerCategory.toLowerCase().includes("infantaria") ||
                            attackerCategory.toLowerCase().includes("comando") ||
                            attackerCategory.toLowerCase().includes("pqd");
        if (isTropaType) {
            if (window.gameNS.destructionVideos && window.gameNS.destructionVideos[attackerName]) { videoPath = window.gameNS.destructionVideos[attackerName]; }
            else if (window.gameNS.destructionVideos && window.gameNS.destructionVideos["GENERIC_TROPA"]) { videoPath = window.gameNS.destructionVideos["GENERIC_TROPA"];}
        }
        if (!videoPath && window.gameNS.destructionVideos && window.gameNS.destructionVideos[attackerCategory]) { videoPath = window.gameNS.destructionVideos[attackerCategory];}
        if (!videoPath && window.gameNS.destructionVideos && window.gameNS.destructionVideos["DEFAULT"]) { videoPath = window.gameNS.destructionVideos["DEFAULT"]; }

        if (videoPath && window.gameNS.settings.animationsEnabled) { 
            if (window.gameNS.ui && typeof window.gameNS.ui.showDestructionVideo === 'function') { window.gameNS.ui.showDestructionVideo(videoPath); }
        } else {
            if (window.gameNS.ui && typeof window.gameNS.ui.resetDestructionVideoArea === 'function') { window.gameNS.ui.resetDestructionVideoArea(); }
        }
        
        performUnitDataDestruction(destroyedInstanceId, window.gameNS.cardProperties[currentTargetOriginalKey], attackerIdForVictoryCheck);
        
        if (window.gameNS.gameState && !window.gameNS.gameState.isGameOver) {
            if (window.gameNS.placedUnits[attackerIdForVictoryCheck]) {
                window.gameNS.placedUnits[attackerIdForVictoryCheck].hasAttackedThisTurn = true;
            }
            window.gameNS.cancelAimingMode?.();
        }
    };

    if (newBlindagem <= 0) {
        const targetTokenElement = document.querySelector(`.unit-map-token[data-token-id='${targetInstanceId}']`);
        const unitImageElementOriginal = targetTokenElement ? targetTokenElement.querySelector('img') : null;

        if (window.gameNS.settings.animationsEnabled && targetTokenElement && unitImageElementOriginal) {
            const originalRect = targetTokenElement.getBoundingClientRect();
            const animToken2D = targetTokenElement.cloneNode(true);
            animToken2D.id = `anim-2d-death-${targetInstanceId}`;
            animToken2D.style.pointerEvents = 'none';
            targetTokenElement.style.visibility = 'hidden';
            animToken2D.classList.add('unit-token-death-animation');
            animToken2D.style.width = `${originalRect.width}px`;
            animToken2D.style.height = `${originalRect.height}px`;
            animToken2D.style.top = `${originalRect.top}px`;
            animToken2D.style.left = `${originalRect.left}px`;
            animToken2D.style.transform = '';
            document.body.appendChild(animToken2D);
            void animToken2D.offsetWidth;
            animToken2D.classList.add('unit-token-grown-centered');
            const targetHeightVh = 80;
            const screenHeight = window.innerHeight;
            const targetPixelHeight = (screenHeight * targetHeightVh) / 100;
            let targetPixelWidth = targetPixelHeight;
            const imgInClone2D = animToken2D.querySelector('img');
            if (imgInClone2D && imgInClone2D.naturalWidth > 0 && imgInClone2D.naturalHeight > 0) {
                const aspectRatio = imgInClone2D.naturalWidth / imgInClone2D.naturalHeight;
                targetPixelWidth = targetPixelHeight * aspectRatio;
            } else if (originalRect.width > 0 && originalRect.height > 0) {
                const aspectRatio = originalRect.width / originalRect.height;
                targetPixelWidth = targetPixelHeight * aspectRatio;
            }
            animToken2D.style.height = `${targetPixelHeight}px`;
            animToken2D.style.width = `${targetPixelWidth}px`;
            let growthAnimationCompleted = false;
            const on2DGrowAnimationEnd = function(event) {
                if (event.target === animToken2D && (event.propertyName === 'height' || event.propertyName === 'transform' || event.propertyName === 'width')) {
                    if (growthAnimationCompleted) return;
                    growthAnimationCompleted = true;
                    animToken2D.removeEventListener('transitionend', on2DGrowAnimationEnd);
                    const pauseDuration = 2000;
                    setTimeout(() => {
                        animToken2D.style.display = 'none';
                        const unitOriginalImageSrc = unitImageElementOriginal.src;
                        startCardExplosionAnimation(unitOriginalImageSrc, () => {
                            if (animToken2D.parentNode) animToken2D.parentNode.removeChild(animToken2D);
                            if (targetTokenElement && targetTokenElement.parentNode) targetTokenElement.parentNode.removeChild(targetTokenElement);
                            handlePostDestructionLogicWrapper(baseAttackerData, targetInstance.originalUnitIdKey, targetInstanceId, attackerInstanceId);
                        });
                    }, pauseDuration);
                }
            };
            animToken2D.addEventListener('transitionend', on2DGrowAnimationEnd);
        } else {
            if (targetTokenElement) {
                if (typeof targetTokenElement.classList?.add === 'function') {
                    targetTokenElement.classList.add('unit-token-destroyed');
                    setTimeout(() => { if (targetTokenElement.parentNode) targetTokenElement.parentNode.removeChild(targetTokenElement); }, 500);
                } else if (targetTokenElement.parentNode) { targetTokenElement.parentNode.removeChild(targetTokenElement); }
            }
            handlePostDestructionLogicWrapper(baseAttackerData, targetInstance.originalUnitIdKey, targetInstanceId, attackerInstanceId);
        }
    } else {
        console.log(`%c[COMBAT executeAttack] Alvo ${targetInstanceId} danificado. Blindagem restante: ${newBlindagem}`, 'color: yellow;');
        if (damageDealt > 0 && !targetInstance.isDamaged) {
            window.gameNS.placedUnits[targetInstanceId].isDamaged = true;
            const originalMovimento = parseInt(baseTargetData.DESLOCAMENTO) || 0;
            const originalAlcance = parseInt(baseTargetData.ALCANCE) || 0;
            window.gameNS.placedUnits[targetInstanceId].currentMovimento = Math.floor(originalMovimento / 2);
            window.gameNS.placedUnits[targetInstanceId].currentAlcance = Math.floor(originalAlcance / 2);
            const damagedTokenElement = document.querySelector(`.unit-map-token[data-token-id='${targetInstanceId}']`);
            if(damagedTokenElement) damagedTokenElement.classList.add('is-damaged');
        }
        if (window.gameNS.activeUnitForAction?.unitIdKey === targetInstanceId) {
            window.gameNS.populateUnitInfo?.(targetInstanceId, true);
        }
        window.gameNS.placedUnits[attackerInstanceId].hasAttackedThisTurn = true;
        if (window.gameNS.gameState && !window.gameNS.gameState.isGameOver) { 
            window.gameNS.cancelAimingMode?.();
        }
    }
    return true;
};