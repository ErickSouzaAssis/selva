// game-logic.js

window.gameNS = window.gameNS || {};

const SAVE_SLOTS_KEY = 'selvaGameSaveSlots';
const MAX_SAVE_SLOTS = 5;

window.gameNS.gameState = {
    gameMode: 'N/A', 
    difficulty: 'N/A',
    currentTurn: '1',
    currentPlayerName: 'N/A',
    currentPlayerCountry: 'N/A',
    player1Name: '',
    player1Country: '',
    player2Name: '',
    player2Country: '',
    currentPlayerCountryForResourceFilter: 'N/A',
    currentPhaseId: null, 
    mapFile: null,
    gameModeBeenSetThisSession: false,
    placedUnits: {}, 
    unitInstanceCounters: {}, 
    activeUnitInstanceId: null,
    timestamp: null,
    isGameOver: false, 
    gameId: null, 
    localPlayerKey: null // Esta será populada pelo roraima_online.html
};

window.gameNS.settings = {
    musicMuted: false,
    musicVolume: 0.5,
    sfxMuted: false,
    cardExplosionAnimationEnabled: true, 
    destructionVideoAnimationEnabled: true 
};

window.gameNS.ui = window.gameNS.ui || {};
window.gameNS.logic = window.gameNS.logic || {};
window.gameNS.utils = window.gameNS.utils || {};

window.gameNS.initializeCampaignGame = function(setupInfo) {
    console.log("[INIT game-logic OFFLINE] Inicializando Campanha com setupInfo:", JSON.parse(JSON.stringify(setupInfo))); 
    if (!setupInfo || !setupInfo.gameMode) { 
        console.error("[INIT game-logic OFFLINE] Sem setupInfo válido para campanha."); 
        window.gameNS.gameState.gameMode = 'ERROR_NO_SETUP'; 
        window.gameNS.gameState.gameModeBeenSetThisSession = true; 
        return; 
    }
    const gs = window.gameNS.gameState; 
    gs.gameMode = 'Campanha'; 
    gs.difficulty = setupInfo.difficulty || 'Médio'; 
    gs.currentPhaseId = setupInfo.currentPhaseId || null; 
    gs.player1Name = setupInfo.player1Name || 'General Anônimo'; 
    gs.player1Country = setupInfo.player1Country || 'BRASIL'; 
    gs.currentPlayerName = gs.player1Name; 
    gs.currentPlayerCountry = gs.player1Country; 
    gs.currentTurn = setupInfo.currentTurn?.toString() || '1'; 
    gs.mapFile = setupInfo.mapFile || "mapa_roraima.html"; 
    gs.currentPlayerCountryForResourceFilter = gs.currentPlayerCountry; 
    gs.gameModeBeenSetThisSession = true; 
    gs.placedUnits = {}; 
    gs.unitInstanceCounters = {}; 
    gs.activeUnitInstanceId = null; 
    gs.isGameOver = false; 

    localStorage.setItem('gameSetupInfo', JSON.stringify(setupInfo)); 
    console.log("[INIT game-logic OFFLINE] Campanha iniciada. Novo gameState:", JSON.parse(JSON.stringify(gs))); 
};

window.gameNS.initializeMultiplayerLocalGame = function(setupInfo) {
    console.log("[INIT game-logic OFFLINE] Inicializando Multiplayer Local com setupInfo:", JSON.parse(JSON.stringify(setupInfo))); 
    if (!setupInfo || !setupInfo.gameMode) { 
        console.error("[INIT game-logic OFFLINE] Sem setupInfo válido para multiplayer local."); 
        window.gameNS.gameState.gameMode = 'ERROR_NO_SETUP'; 
        window.gameNS.gameState.gameModeBeenSetThisSession = true; 
        return; 
    }
    const gs = window.gameNS.gameState; 
    gs.gameMode = 'Versus Local'; 
    gs.difficulty = 'N/A'; 
    gs.currentPhaseId = null; 

    gs.player1Name = setupInfo.player1Name || 'Jogador 1'; 
    gs.player1Country = setupInfo.player1Country || 'BRASIL'; 
    gs.player2Name = setupInfo.player2Name || 'Jogador 2'; 
    gs.player2Country = setupInfo.player2Country || 'VENEZUELA'; 

    gs.currentPlayerName = setupInfo.currentPlayerName || gs.player1Name; 
    gs.currentPlayerCountry = setupInfo.currentPlayerCountry || gs.player1Country; 
    gs.currentTurn = setupInfo.currentTurn?.toString() || '1'; 
    gs.mapFile = setupInfo.mapFile || "mapa_roraima.html"; 

    gs.currentPlayerCountryForResourceFilter = gs.currentPlayerCountry; 
    gs.gameModeBeenSetThisSession = true; 
    gs.placedUnits = {}; 
    gs.unitInstanceCounters = {}; 
    gs.activeUnitInstanceId = null; 
    gs.isGameOver = false; 

    localStorage.setItem('gameSetupInfo', JSON.stringify(setupInfo)); 
    console.log("[INIT game-logic OFFLINE] Multiplayer Local iniciado. Novo gameState:", JSON.parse(JSON.stringify(gs))); 
};

window.gameNS.endTurn = function() {
    if (window.gameNS.gameState.isGameOver) {
        alert("O jogo já terminou. Não é possível passar o turno.");
        return;
    }

    if (window.gameNS.isAiming && typeof window.gameNS.cancelAimingMode === 'function') { 
        window.gameNS.cancelAimingMode(); 
    }
    if (typeof window.gameNS.clearUnitInfo === 'function') { 
        window.gameNS.clearUnitInfo(); 
    } else if (typeof window.gameNS.clearActionHighlights === 'function') { 
        window.gameNS.clearActionHighlights(); 
    }

    if (window.gameNS.gameState.gameMode === 'Versus Online') {
        console.log("%c[TURNO ONLINE] Iniciando processo de passar o turno...", "color: #FF8C00; font-weight: bold;"); 
        // MODIFICAÇÃO: Usar as variáveis globais de window.gameNS
        if (!window.firebaseRoomData || !window.gameNS.gameRoomRef || !window.gameNS.localPlayerKey) {
            console.error("[TURNO ONLINE] Variáveis globais do Firebase não definidas (firebaseRoomData, window.gameNS.gameRoomRef, window.gameNS.localPlayerKey).");
            alert("Erro de configuração online. Não é possível passar o turno.");
            return;
        }

        // MODIFICAÇÃO: Usar window.gameNS.localPlayerKey
        if (window.firebaseRoomData.currentTurnPlayerKey !== window.gameNS.localPlayerKey) {
            alert("Não é seu turno!");
            return;
        }

        let nextPlayerKey;
        let newTurnNumber = parseInt(window.firebaseRoomData.currentTurnNumber);
        let currentP1Country = window.firebaseRoomData.player1 ? window.firebaseRoomData.player1.country : 'N/A';
        let currentP2Country = window.firebaseRoomData.player2 ? window.firebaseRoomData.player2.country : 'N/A';

        // MODIFICAÇÃO: Usar window.gameNS.localPlayerKey
        if (window.gameNS.localPlayerKey === 'player1') {
            nextPlayerKey = 'player2';
        } else { 
            nextPlayerKey = 'player1';
            newTurnNumber++; 
        }

        const updates = {};
        updates['currentTurnPlayerKey'] = nextPlayerKey;
        updates['currentTurnNumber'] = newTurnNumber;
        updates['gameStateLastUpdate'] = firebase.database.ServerValue.TIMESTAMP; 

        const nextPlayerCountry = (nextPlayerKey === 'player1') ? currentP1Country : currentP2Country;
        let unitsResetCount = 0;
        if (window.firebaseRoomData && window.firebaseRoomData.placedUnits) {
            for (const unitId in window.firebaseRoomData.placedUnits) {
                const unit = window.firebaseRoomData.placedUnits[unitId];
                if (unit && unit.PAÍS === nextPlayerCountry) {
                    updates[`placedUnits/${unitId}/hasMovedThisTurn`] = false;
                    updates[`placedUnits/${unitId}/hasAttackedThisTurn`] = false;
                    unitsResetCount++;
                }
            }
        }
        console.log(`[TURNO ONLINE] ${unitsResetCount} unidades de ${nextPlayerKey} (${nextPlayerCountry}) serão resetadas no Firebase.`);

        // MODIFICAÇÃO: Usar window.gameNS.gameRoomRef
        window.gameNS.gameRoomRef.update(updates)
            .then(() => {
                console.log(`%c[TURNO ONLINE] Turno atualizado no Firebase. Próximo jogador: ${nextPlayerKey}, País: ${nextPlayerCountry}, Turno Geral: ${newTurnNumber}`, "color: lightgreen; font-weight: bold;");
                 const nextPlayerNameDisplay = (nextPlayerKey === 'player1' && window.firebaseRoomData.player1) ? window.firebaseRoomData.player1.name :
                                     (nextPlayerKey === 'player2' && window.firebaseRoomData.player2) ? window.firebaseRoomData.player2.name : "Oponente";
                // O alert pode ser removido ou mantido, a UI deve atualizar via listener do Firebase.
                // alert(`Turno passado! Próximo a jogar: ${nextPlayerNameDisplay}\nTurno Geral: ${newTurnNumber}`);
            })
            .catch(error => {
                console.error("[TURNO ONLINE] Erro ao passar o turno no Firebase:", error);
                alert("Erro ao tentar passar o turno online. Verifique o console.");
            });

    } else { 
        console.log("%c[TURNO LOCAL] Iniciando processo de passar o turno...", "color: #4D90FE; font-weight: bold;"); 
        const currentGame = window.gameNS.gameState;

        if (!currentGame || !currentGame.gameMode || currentGame.gameMode === 'N/A' || currentGame.gameMode === 'ERROR_NO_SETUP') { 
            console.error("[TURNO LOCAL endTurn] Informações do jogo (gameMode) não encontradas ou inválidas!"); 
            alert("Erro crítico: Não foi possível passar o turno devido à falta de dados do jogo."); 
            return; 
        }

        let nextPlayerName = currentGame.currentPlayerName; 
        let nextPlayerCountry = currentGame.currentPlayerCountry; 
        let newTurnNumberLocal = parseInt(currentGame.currentTurn); 

        if (currentGame.gameMode === "Versus Local") { 
            if (!currentGame.player1Name || !currentGame.player2Name || !currentGame.player1Country || !currentGame.player2Country) { 
                console.error("[TURNO LOCAL endTurn] Nomes/países dos jogadores para 'Versus Local' não definidos."); 
                return; 
            }
            if (currentGame.currentPlayerName === currentGame.player1Name) { 
                nextPlayerName = currentGame.player2Name; 
                nextPlayerCountry = currentGame.player2Country; 
            } else if (currentGame.currentPlayerName === currentGame.player2Name) { 
                nextPlayerName = currentGame.player1Name; 
                nextPlayerCountry = currentGame.player1Country; 
                newTurnNumberLocal++; 
            } else {
                console.warn("[TURNO LOCAL endTurn] Jogador atual inconsistente. Resetando para Jogador 1."); 
                nextPlayerName = currentGame.player1Name; 
                nextPlayerCountry = currentGame.player1Country; 
            }
        } else if (currentGame.gameMode === "Campanha") { 
            newTurnNumberLocal++; 
        } else {
            console.warn(`[TURNO LOCAL endTurn] Modo de jogo "${currentGame.gameMode}" não implementado para passar turno local.`); 
            return; 
        }

        currentGame.currentPlayerName = nextPlayerName; 
        currentGame.currentPlayerCountry = nextPlayerCountry; 
        currentGame.currentTurn = newTurnNumberLocal.toString(); 
        currentGame.currentPlayerCountryForResourceFilter = nextPlayerCountry; 

        console.log(`%c[TURNO LOCAL] Novo estado: Jogador: ${currentGame.currentPlayerName} (${currentGame.currentPlayerCountry}), Turno: ${currentGame.currentTurn}`, "color: #4D90FE;"); 

        try {
            const currentSetupInfo = JSON.parse(localStorage.getItem('gameSetupInfo')) || {}; 
            currentSetupInfo.currentPlayerName = currentGame.currentPlayerName; 
            currentSetupInfo.currentPlayerCountry = currentGame.currentPlayerCountry; 
            currentSetupInfo.currentTurn = currentGame.currentTurn; 
            localStorage.setItem('gameSetupInfo', JSON.stringify(currentSetupInfo)); 
        } catch (e) {
            console.error("[TURNO LOCAL endTurn] Erro ao atualizar gameSetupInfo no localStorage:", e); 
        }

        if (currentGame.placedUnits) { 
            let unitsResetCount = 0; 
            for (const unitId in currentGame.placedUnits) { 
                const unit = currentGame.placedUnits[unitId]; 
                if (unit.PAÍS === currentGame.currentPlayerCountry) { 
                    unit.hasMovedThisTurn = false; 
                    unit.hasAttackedThisTurn = false; 
                    unitsResetCount++; 
                }
            }
            console.log(`[TURNO LOCAL] ${unitsResetCount} unidades de ${currentGame.currentPlayerName} resetadas.`); 
        }

        if (typeof window.gameNS.loadAndDisplayGameInfo === 'function') { 
            window.gameNS.loadAndDisplayGameInfo(); 
        }
        if (typeof window.gameNS.populateForcaFilter === 'function') { 
            window.gameNS.populateForcaFilter(currentGame.currentPlayerCountryForResourceFilter); 
            if (typeof window.gameNS.updateCategoriaFilter === 'function') window.gameNS.updateCategoriaFilter("todos"); 
            if (typeof window.gameNS.applyFilters === 'function') window.gameNS.applyFilters(); 
        }

        if (typeof window.gameNS.saveGameToSlot === 'function') { 
            window.gameNS.saveGameToSlot(-1); 
        } else {
            console.warn("[TURNO LOCAL endTurn] Função saveGameToSlot não encontrada. Jogo local não será salvo automaticamente."); 
        }

        alert(`Turno de: ${currentGame.currentPlayerName}\nTurno Geral: ${currentGame.currentTurn}`); 
        console.log(`%c[TURNO LOCAL] Fim do processo. Próximo jogador: ${currentGame.currentPlayerName}, País: ${currentGame.currentPlayerCountry}, Turno Geral: ${currentGame.currentTurn}`, "color: lightblue; font-weight: bold;"); 
    }

    if (window.gameNS.ui && typeof window.gameNS.ui.resetDestructionVideoArea === 'function') { 
        window.gameNS.ui.resetDestructionVideoArea(); 
    }
};


window.gameNS.endGameWithResult = function(winnerPlayerName, winningCountry, losingCountry, specificEventMessage, reason) {
    const gameOverPopupIsVisible = window.gameNS.ui && typeof window.gameNS.ui.isGameOverPopupVisible === 'function' ? window.gameNS.ui.isGameOverPopupVisible() : false;
    if (window.gameNS.gameState.isGameOver && gameOverPopupIsVisible) { 
        console.warn("[FIM DE JOGO] Tentativa de finalizar um jogo que já terminou e popup está visível."); 
        return; 
    }
    console.log(`[FIM DE JOGO] Notificado: ${winnerPlayerName}(${winningCountry}). Razão: ${reason}. Mensagem: ${specificEventMessage}`); 

    window.gameNS.gameState.isGameOver = true; 

    if (window.gameNS.gameState.gameMode !== 'Versus Online') {
        if (typeof window.gameNS.saveGameToSlot === 'function') { 
            window.gameNS.saveGameToSlot(-1); 
            console.log("[FIM DE JOGO LOCAL] Estado final do jogo salvo automaticamente."); 
        }
    }

    let popupTitle = `Parabéns! ${winningCountry || winnerPlayerName} venceu a partida!`; 
    let popupMessage = specificEventMessage || `${losingCountry || 'O oponente'} não tem mais condições de continuar.`; 

    if (reason === "QG_DESTRUCTION_ERROR") { 
        popupTitle = "Fim de Jogo Inesperado"; 
    } else if (winnerPlayerName === "EMPATE") { 
        popupTitle = "Empate!"; 
        popupMessage = specificEventMessage || "O jogo terminou em empate."; 
    }


    let victoryVideoPath = "vd/brasilVence.mp4"; 
    if (winningCountry === "BRASIL") { 
        victoryVideoPath = "vd/brasilVence.mp4"; 
    } else if (winningCountry === "VENEZUELA") { 
        victoryVideoPath = "vd/venezuelaVence.mp4"; 
    } 

    if (window.gameNS.ui && typeof window.gameNS.ui.showGameOverPopup === 'function') { 
        window.gameNS.ui.showGameOverPopup(popupTitle, popupMessage, victoryVideoPath); 
    } else {
        alert(`${popupTitle}\n${popupMessage}`); 
        console.error("[FIM DE JOGO] Função window.gameNS.ui.showGameOverPopup não encontrada."); 
    }

    const endTurnButton = document.getElementById('sidebar-btn-end-turn'); 
    if (endTurnButton) { 
        endTurnButton.disabled = true; 
        endTurnButton.style.opacity = 0.5; 
        endTurnButton.textContent = "Fim de Jogo"; 
    }
};


window.gameNS.saveGameToSlot = function(slotIndex) {
    if (window.gameNS.gameState.gameMode === 'Versus Online') {
        console.warn("[SALVAR JOGO] Tentativa de salvar jogo online localmente. Ação ignorada. O estado é gerenciado pelo Firebase.");
        return false;
    }

    const effectiveSlotIndex = (slotIndex === -1) ? 0 : slotIndex; 
    const isAutosave = (slotIndex === -1); 

    if (effectiveSlotIndex < 0 || effectiveSlotIndex >= MAX_SAVE_SLOTS) { 
        console.error(`[SALVAR JOGO LOCAL] Índice de slot inválido: ${effectiveSlotIndex}.`); 
        if (!isAutosave) alert("Erro: Slot de salvamento inválido."); 
        return false; 
    }

    if (!isAutosave) {
        console.log(`%c[SALVAR JOGO LOCAL] Salvamento manual para Slot ${effectiveSlotIndex + 1}...`, "color: #007bff; font-weight: bold;"); 
    } else {
        console.log(`%c[AUTOSAVE LOCAL] Autosave (Slot 0)...`, "color: #007bff;"); 
    }

    if (!window.gameNS.gameState.mapFile) { 
        const pathArray = window.location.pathname.split('/'); 
        const currentHTMLFile = pathArray[pathArray.length - 1] || "mapa_roraima.html"; 
        window.gameNS.gameState.mapFile = currentHTMLFile; 
        console.warn(`[SALVAR JOGO LOCAL] mapFile não estava em gameState. Inferido como: ${currentHTMLFile}`); 
    }

    window.gameNS.gameState.activeUnitInstanceId = window.gameNS.activeUnitForAction ? window.gameNS.activeUnitForAction.unitIdKey : null; 
    window.gameNS.gameState.timestamp = new Date().toISOString(); 

    const gameStateToSave = JSON.parse(JSON.stringify(window.gameNS.gameState)); 

    try {
        let savedGames = JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY)) || Array(MAX_SAVE_SLOTS).fill(null); 
        if (!Array.isArray(savedGames) || savedGames.length !== MAX_SAVE_SLOTS) { 
            const tempSaved = Array.isArray(savedGames) ? [...savedGames] : []; 
            savedGames = Array(MAX_SAVE_SLOTS).fill(null); 
            for(let i = 0; i < Math.min(tempSaved.length, MAX_SAVE_SLOTS); i++) { 
                if (tempSaved[i]) savedGames[i] = tempSaved[i]; 
            }
        }

        savedGames[effectiveSlotIndex] = gameStateToSave; 
        localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(savedGames)); 

        if (!isAutosave) {
            console.log(`%c[SALVAR JOGO LOCAL] Jogo salvo no Slot ${effectiveSlotIndex + 1}!`, "color: lightgreen;"); 
            const savePopup = document.getElementById('popup-save-game'); 
            if (savePopup && !savePopup.classList.contains('popup-hidden')) { 
                alert(`Jogo salvo no Slot ${effectiveSlotIndex + 1}.`); 
            }
        } else {
            console.log(`%c[AUTOSAVE LOCAL] Autosave (Slot 0) concluído.`, "color: lightgreen;"); 
        }
        return true; 
    } catch (error) {
        console.error(`[SALVAR JOGO LOCAL] Erro ao salvar no Slot ${effectiveSlotIndex + 1}:`, error); 
        if (!isAutosave) alert("Erro ao salvar o jogo localmente."); 
        return false; 
    }
};

window.gameNS.showHexInfo = function(clickPageX, clickPageY, row, col, alphaNumCoord) { 
    const infoPopup = document.getElementById('info-popup'); 
    if (!infoPopup) { console.error("GAME-LOGIC (showHexInfo): #info-popup NÃO FOI ENCONTRADO!"); return; } 
    const gameBoardElement = document.getElementById('game-board'); 
    if (!gameBoardElement) { console.error("GAME-LOGIC (showHexInfo): #game-board NÃO FOI ENCONTRADO."); return; } 
    const gameBoardRect = gameBoardElement.getBoundingClientRect(); 
    let popupContent = `Coord: ${alphaNumCoord} (L:${parseInt(row)+1},C:${parseInt(col)+1})`; 

    if (window.gameNS.terrainData && window.gameNS.terrainData[alphaNumCoord]) { 
        const terrainInfo = window.gameNS.terrainData[alphaNumCoord]; 
        popupContent += `<br><strong>Terreno:</strong> ${terrainInfo.Geografia || 'N/A'}`; 
        if (terrainInfo.Deslocamento != 0 && terrainInfo.Deslocamento != null) { popupContent += `<br><strong>Mod. Desloc.:</strong> ${terrainInfo.Deslocamento > 0 ? '+' : ''}${terrainInfo.Deslocamento}`; } 
        if (terrainInfo.Visibilidade != 0 && terrainInfo.Visibilidade != null) { popupContent += `<br><strong>Mod. Visib.:</strong> ${terrainInfo.Visibilidade > 0 ? '+' : ''}${terrainInfo.Visibilidade}`; } 
        if (terrainInfo.Alcance != 0 && terrainInfo.Alcance != null) { popupContent += `<br><strong>Mod. Alcance:</strong> ${terrainInfo.Alcance > 0 ? '+' : ''}${terrainInfo.Alcance}`; } 
        if (terrainInfo.DominadoPor) { popupContent += `<br><strong>Domínio:</strong> ${terrainInfo.DominadoPor}`; } 
        if (terrainInfo.OBS && terrainInfo.OBS.trim() !== "" && terrainInfo.OBS.trim().toUpperCase() !== "TERRESTRE" && terrainInfo.OBS.trim().toUpperCase() !== "TODOS") { popupContent += `<br><em>OBS: ${terrainInfo.OBS}</em>`; } 
    } else {
        popupContent += `<br><em style="color:red;">Dados do terreno não encontrados para ${alphaNumCoord}</em>`; 
    }
    infoPopup.innerHTML = popupContent; 
    let popupX = clickPageX - gameBoardRect.left; 
    let popupY = clickPageY - gameBoardRect.top; 
    const popupWidth = infoPopup.offsetWidth; 
    const popupHeight = infoPopup.offsetHeight; 
    const cursorOffset = 15; 
    if (popupX + popupWidth + cursorOffset > gameBoardRect.width) { popupX = clickPageX - gameBoardRect.left - popupWidth - 5; } else { popupX += cursorOffset; } 
    if (popupY + popupHeight + cursorOffset > gameBoardRect.height) { popupY = clickPageX - gameBoardRect.top - popupHeight - 5; } else { popupY += cursorOffset; } 
    if (popupX < 5) popupX = 5; 
    if (popupY < 5) popupY = 5; 
    infoPopup.style.left = `${popupX}px`; 
    infoPopup.style.top = `${popupY}px`; 
    infoPopup.style.display = 'block'; 
};

window.gameNS.hideHexInfo = function() { 
    const infoPopup = document.getElementById('info-popup'); 
    if (infoPopup) { infoPopup.style.display = 'none'; } 
};

document.addEventListener('keydown', function(event) { 
    if (event.key === "Escape" || event.key === "Esc") { 
        event.stopPropagation(); 
        
        const gameOverPopup = document.getElementById('popup-game-over'); 
        if (gameOverPopup && !gameOverPopup.classList.contains('popup-hidden')) { 
            return; 
        }
        
        const infoPopup = document.getElementById('info-popup'); 
        if (infoPopup && infoPopup.style.display !== 'none') { 
            window.gameNS.hideHexInfo(); 
            return; 
        }

        if (window.gameNS && window.gameNS.isAiming && typeof window.gameNS.cancelAimingMode === 'function') { 
            window.gameNS.cancelAimingMode(); 
            return; 
        }
        
        if (window.gameNS && window.gameNS.activeUnitForAction && typeof window.gameNS.clearUnitInfo === 'function') { 
            window.gameNS.clearUnitInfo(); 
            return; 
        }
        
        if (window.gameNS && window.gameNS.clearActionHighlights) { 
             window.gameNS.clearActionHighlights(); 
        }
    }
});
