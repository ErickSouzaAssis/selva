// game-logic.js
window.gameNS = window.gameNS || {};

// Constants for Save/Load Game Slots
const SAVE_SLOTS_KEY = 'selvaGameSaveSlots';
const MAX_SAVE_SLOTS = 5;

// --- Global Game State Object ---
// Este objeto é a FONTE DA VERDADE para o estado do jogo.
// Outras variáveis (como window.gameNS.currentGameInfo) devem ser sincronizadas a partir daqui.
window.gameNS.gameState = {
    gameMode: 'N/A',
    difficulty: 'N/A',
    currentTurn: '1', // Mantido como string, mas parseado para int quando necessário
    currentPlayerName: 'N/A',
    currentPlayerCountry: 'N/A',
    player1Name: '',
    player1Country: '',
    player2Name: '',
    player2Country: '',
    currentPlayerCountryForResourceFilter: 'N/A',
    currentPhaseId: null,
    mapFile: null,
    gameModeBeenSetThisSession: false, // Flag para indicar se o modo de jogo foi definido/carregado
    placedUnits: {}, // Todas as unidades instanciadas no mapa
    unitInstanceCounters: {}, // Contadores para sufixos de instâncias (ex: Tanque #1, Tanque #2)
    activeUnitInstanceId: null, // ID da instância da unidade ativa (para salvar/carregar seleção)
    timestamp: null, // Para o slot de save
    isGameOver: false // Flag para indicar se o jogo terminou
};
// ---------------------------------

// Settings não devem estar dentro de gameState, pois são preferências do usuário, não estado do jogo.
window.gameNS.settings = {
    musicMuted: false,
    musicVolume: 0.5,
    sfxMuted: false,
    animationsEnabled: true // Default para morteAnimada
};

// Estes namespaces são úteis.
window.gameNS.ui = window.gameNS.ui || {};
window.gameNS.logic = window.gameNS.logic || {};
window.gameNS.utils = window.gameNS.utils || {};

// --- Funções de Inicialização de Modo de Jogo ---
// Estas funções populAM window.gameNS.gameState

window.gameNS.initializeCampaignGame = function(setupInfo) {
    console.log("[INIT game-logic] Inicializando Campanha com setupInfo:", JSON.parse(JSON.stringify(setupInfo)));
    if (!setupInfo || !setupInfo.gameMode) { // Verifica se setupInfo e gameMode existem
        console.error("[INIT game-logic] Sem setupInfo válido para campanha. Não é possível inicializar.");
        // Definir um estado de erro ou padrão mínimo
        window.gameNS.gameState.gameMode = 'ERROR_NO_SETUP';
        window.gameNS.gameState.gameModeBeenSetThisSession = true; // Marcar como tentativa de setar
        return;
    }
    const gs = window.gameNS.gameState;
    gs.gameMode = 'Campanha';
    gs.difficulty = setupInfo.difficulty || 'Médio';
    gs.currentPhaseId = setupInfo.currentPhaseId || null;
    gs.player1Name = setupInfo.player1Name || 'General Anônimo';
    gs.player1Country = setupInfo.player1Country || 'BRASIL';
    gs.currentPlayerName = gs.player1Name; // Campanha começa com Jogador 1
    gs.currentPlayerCountry = gs.player1Country;
    gs.currentTurn = setupInfo.currentTurn?.toString() || '1'; // Garante que seja string
    gs.mapFile = setupInfo.mapFile || "mapa_roraima.html"; // Padrão se não vier do menu
    gs.currentPlayerCountryForResourceFilter = gs.currentPlayerCountry;
    gs.gameModeBeenSetThisSession = true; // ESSENCIAL
    gs.placedUnits = {}; // Resetar para novo jogo
    gs.unitInstanceCounters = {}; // Resetar para novo jogo
    gs.activeUnitInstanceId = null; // Resetar para novo jogo
    gs.isGameOver = false; // Resetar para novo jogo

    localStorage.setItem('gameSetupInfo', JSON.stringify(setupInfo));
    console.log("[INIT game-logic] Campanha iniciada. Novo gameState:", JSON.parse(JSON.stringify(gs)));
};

window.gameNS.initializeMultiplayerLocalGame = function(setupInfo) {
    console.log("[INIT game-logic] Inicializando Multiplayer Local com setupInfo:", JSON.parse(JSON.stringify(setupInfo)));
    if (!setupInfo || !setupInfo.gameMode) {
        console.error("[INIT game-logic] Sem setupInfo válido para multiplayer local. Não é possível inicializar.");
        window.gameNS.gameState.gameMode = 'ERROR_NO_SETUP';
        window.gameNS.gameState.gameModeBeenSetThisSession = true;
        return;
    }
    const gs = window.gameNS.gameState;
    gs.gameMode = 'Versus Local';
    gs.difficulty = 'N/A'; // Não aplicável para Versus Local
    gs.currentPhaseId = null; // Não aplicável

    gs.player1Name = setupInfo.player1Name || 'Jogador 1';
    gs.player1Country = setupInfo.player1Country || 'BRASIL';
    gs.player2Name = setupInfo.player2Name || 'Jogador 2';
    gs.player2Country = setupInfo.player2Country || 'VENEZUELA';

    gs.currentPlayerName = setupInfo.currentPlayerName || gs.player1Name;
    gs.currentPlayerCountry = setupInfo.currentPlayerCountry || gs.player1Country;
    gs.currentTurn = setupInfo.currentTurn?.toString() || '1';
    gs.mapFile = setupInfo.mapFile || "mapa_roraima.html";

    gs.currentPlayerCountryForResourceFilter = gs.currentPlayerCountry;
    gs.gameModeBeenSetThisSession = true; // ESSENCIAL
    gs.placedUnits = {}; // Resetar para novo jogo
    gs.unitInstanceCounters = {}; // Resetar para novo jogo
    gs.activeUnitInstanceId = null; // Resetar para novo jogo
    gs.isGameOver = false; // Resetar para novo jogo

    localStorage.setItem('gameSetupInfo', JSON.stringify(setupInfo));
    console.log("[INIT game-logic] Multiplayer Local iniciado. Novo gameState:", JSON.parse(JSON.stringify(gs)));
};

// --- Função de Passar o Turno ---
window.gameNS.endTurn = function() {
    if (window.gameNS.gameState.isGameOver) {
        alert("O jogo já terminou. Não é possível passar o turno.");
        return;
    }
    console.log("%c[TURNO] Iniciando processo de passar o turno...", "color: #FF8C00; font-weight: bold;");
    const currentGame = window.gameNS.gameState; // Usa o gameState diretamente

    if (!currentGame || !currentGame.gameMode || currentGame.gameMode === 'N/A' || currentGame.gameMode === 'ERROR_NO_SETUP') {
        console.error("[TURNO endTurn] Informações do jogo (gameMode) não encontradas, inválidas ou erro na inicialização!");
        alert("Erro crítico: Não foi possível passar o turno devido à falta de dados do jogo.");
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


    let nextPlayerName = currentGame.currentPlayerName;
    let nextPlayerCountry = currentGame.currentPlayerCountry;
    let newTurnNumber = parseInt(currentGame.currentTurn); 

    if (currentGame.gameMode === "Versus Local") {
        if (!currentGame.player1Name || !currentGame.player2Name || !currentGame.player1Country || !currentGame.player2Country) {
            console.error("[TURNO endTurn] Nomes/países dos jogadores para modo 'Versus Local' não definidos no gameState.");
            return;
        }
        if (currentGame.currentPlayerName === currentGame.player1Name) {
            nextPlayerName = currentGame.player2Name;
            nextPlayerCountry = currentGame.player2Country;
        } else if (currentGame.currentPlayerName === currentGame.player2Name) {
            nextPlayerName = currentGame.player1Name;
            nextPlayerCountry = currentGame.player1Country;
            newTurnNumber++; 
        } else {
            console.warn("[TURNO endTurn] Jogador atual inconsistente em modo Versus. Resetando para Jogador 1.");
            nextPlayerName = currentGame.player1Name;
            nextPlayerCountry = currentGame.player1Country;
        }
    } else if (currentGame.gameMode === "Campanha") {
        newTurnNumber++; 
    } else {
        console.warn(`[TURNO endTurn] Modo de jogo "${currentGame.gameMode}" não implementado para passar turno.`);
        return;
    }

    currentGame.currentPlayerName = nextPlayerName;
    currentGame.currentPlayerCountry = nextPlayerCountry;
    currentGame.currentTurn = newTurnNumber.toString(); 
    currentGame.currentPlayerCountryForResourceFilter = nextPlayerCountry; 

    console.log(`%c[TURNO] Novo estado (gameState): Jogador: ${currentGame.currentPlayerName} (${currentGame.currentPlayerCountry}), Turno: ${currentGame.currentTurn}, FiltroRec: ${currentGame.currentPlayerCountryForResourceFilter}`, "color: #FF8C00;");

    try {
        const currentSetupInfo = JSON.parse(localStorage.getItem('gameSetupInfo')) || {};
        currentSetupInfo.currentPlayerName = currentGame.currentPlayerName;
        currentSetupInfo.currentPlayerCountry = currentGame.currentPlayerCountry;
        currentSetupInfo.currentTurn = currentGame.currentTurn;
        localStorage.setItem('gameSetupInfo', JSON.stringify(currentSetupInfo));
    } catch (e) {
        console.error("[TURNO endTurn] Erro ao atualizar gameSetupInfo no localStorage:", e);
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
        console.log(`[TURNO] ${unitsResetCount} unidades de ${currentGame.currentPlayerName} (novo jogador) resetadas para o turno.`);
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
        console.warn("[TURNO endTurn] Função window.gameNS.saveGameToSlot não encontrada. O jogo não será salvo automaticamente.");
    }

    if (window.gameNS.ui && typeof window.gameNS.ui.resetDestructionVideoArea === 'function') {
        window.gameNS.ui.resetDestructionVideoArea();
    }

    alert(`Turno de: ${currentGame.currentPlayerName}\nTurno Geral: ${currentGame.currentTurn}`);
    console.log(`%c[TURNO] Fim do processo. Próximo jogador: ${currentGame.currentPlayerName}, País: ${currentGame.currentPlayerCountry}, Turno Geral: ${currentGame.currentTurn}`, "color: lightgreen; font-weight: bold;");
};


// --- Função de Fim de Jogo ---
/**
 * Handles the end of the game.
 * @param {string} winnerPlayerName - The name of the winning player.
 * @param {string} winningCountry - The country of the winning player.
 * @param {string} losingCountry - The country of the losing player.
 * @param {string} specificEventMessage - A detailed message about why the game ended (for logging).
 * @param {string} reason - A code for the reason the game ended (e.g., "QG_DESTRUCTION").
 */
window.gameNS.endGameWithResult = function(winnerPlayerName, winningCountry, losingCountry, specificEventMessage, reason) {
    if (window.gameNS.gameState.isGameOver) {
        console.warn("[FIM DE JOGO] Tentativa de finalizar um jogo que já terminou.");
        return;
    }
    console.log(`[FIM DE JOGO] Iniciado por ${winnerPlayerName}(${winningCountry}). Razão: ${reason}. Mensagem específica: ${specificEventMessage}`);

    window.gameNS.gameState.isGameOver = true;

    if (typeof window.gameNS.saveGameToSlot === 'function') {
        window.gameNS.saveGameToSlot(-1); // -1 indicates autosave
        console.log("[FIM DE JOGO] Estado final do jogo salvo automaticamente.");
    } else {
        console.warn("[FIM DE JOGO] Função saveGameToSlot não encontrada. O estado final não foi salvo.");
    }

    let popupTitle = `Parabéns! ${winningCountry} venceu a partida!`;
    let popupMessage = `${losingCountry} está sem recursos significativos na área.`;

    if (reason === "QG_DESTRUCTION") {
        // A mensagem genérica já é boa. Se quiser algo mais específico para o popup:
        // popupMessage = `O Centro de Comando de ${losingCountry} foi destruído! ${winnerPlayerName} (${winningCountry}) é o vitorioso!`;
        // Ou manter a mensagem original do usuário: `${losingCountry} está sem recursos significativos na área.`
    } else if (reason === "QG_DESTRUCTION_ERROR") { // Caso de erro que veio de combat-logic
        popupTitle = "Fim de Jogo Inesperado";
        popupMessage = specificEventMessage || "Erro ao determinar o vencedor.";
    }


    // Lógica para vídeo de vitória específico por país
    let victoryVideoPath = "vd/brasilVence.mp4"; // Vídeo padrão

    if (winningCountry === "BRASIL") {
        victoryVideoPath = "vd/brasilVence.mp4"; // Substitua pelo caminho real do vídeo
    } else if (winningCountry === "VENEZUELA") {
        victoryVideoPath = "vd/venezuelaVence.mp4"; // Substitua pelo caminho real do vídeo
    }
    // Adicione mais 'else if' para outros países, se necessário.

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
     // Opcional: desabilitar outros controles da UI aqui também
};


// --- Funções de Gerenciamento de Estado (Salvar/Carregar Jogo) ---
window.gameNS.saveGameToSlot = function(slotIndex) {
    const effectiveSlotIndex = (slotIndex === -1) ? 0 : slotIndex; 
    const isAutosave = (slotIndex === -1);

    if (effectiveSlotIndex < 0 || effectiveSlotIndex >= MAX_SAVE_SLOTS) {
        console.error(`[SALVAR JOGO] Índice de slot efetivo inválido: ${effectiveSlotIndex}.`);
        if (!isAutosave) alert("Erro: Slot de salvamento inválido.");
        return false;
    }

    if (!isAutosave) {
        console.log(`%c[SALVAR JOGO] Iniciando salvamento manual para Slot ${effectiveSlotIndex + 1}...`, "color: #007bff; font-weight: bold;");
    } else {
        console.log(`%c[AUTOSAVE] Iniciando autosave (Slot 0)...`, "color: #007bff;");
    }

    if (!window.gameNS.gameState.mapFile) {
        const pathArray = window.location.pathname.split('/');
        const currentHTMLFile = pathArray[pathArray.length - 1] || "mapa_roraima.html"; 
        window.gameNS.gameState.mapFile = currentHTMLFile;
        console.warn(`[SALVAR JOGO] mapFile não estava em gameState. Inferido como: ${currentHTMLFile}`);
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
            console.log(`%c[SALVAR JOGO] Estado do jogo salvo com sucesso no Slot ${effectiveSlotIndex + 1}!`, "color: lightgreen;");
            const savePopup = document.getElementById('popup-save-game'); 
            if (savePopup && !savePopup.classList.contains('popup-hidden')) { 
                alert(`Jogo salvo no Slot ${effectiveSlotIndex + 1}.`);
            }
        } else {
            console.log(`%c[AUTOSAVE] Autosave (Slot 0) concluído.`, "color: lightgreen;");
            localStorage.setItem('savedGameState', JSON.stringify(gameStateToSave));
        }
        return true;
    } catch (error) {
        console.error(`[SALVAR JOGO] Erro ao serializar ou salvar o estado do jogo no Slot ${effectiveSlotIndex + 1}:`, error);
        if (!isAutosave) alert("Erro ao salvar o jogo. Verifique o console para mais detalhes.");
        return false;
    }
};


// --- Funções de Interface (Exibir Informações) ---
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
    if (popupY + popupHeight + cursorOffset > gameBoardRect.height) { popupY = clickPageY - gameBoardRect.top - popupHeight - 5; } else { popupY += cursorOffset; }
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
        
        // Check for game over popup first
        const gameOverPopup = document.getElementById('popup-game-over');
        if (gameOverPopup && !gameOverPopup.classList.contains('popup-hidden')) {
            // Do nothing if game over popup is visible, or handle specific actions for it
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