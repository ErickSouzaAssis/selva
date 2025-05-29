// ui-layout.js

window.gameNS = window.gameNS || {};
let backgroundMusicPlayer = null; // Referência global para o player de áudio de fundo
window.gameNS.morteAnimada = true;
window.gameNS.cardProperties = {};
window.gameNS.terrainData = {};
window.gameNS.placedUnits = {};
window.gameNS.unitInstanceCounters = {};

window.gameNS.settings = {
    musicMuted: false,
    musicVolume: 0.5,
    sfxMuted: false,
    animationsEnabled: window.gameNS.morteAnimada
};

// ESTA VARIÁVEL NÃO DEVE SER A FONTE DA VERDADE. LEIA DE window.gameNS.gameState
// É mantida para compatibilidade temporária ou para UI que ainda não foi migrada.
window.gameNS.currentGameInfo = {
    gameMode: 'N/A', difficulty: 'N/A', currentPlayerName: 'N/A',
    currentPlayerCountry: 'N/A', currentTurn: '1', player1Name: '',
    player1Country: '', player2Name: '', player2Country: '',
    currentPlayerCountryForResourceFilter: 'N/A',
    gameModeBeenSetThisSession: false
};

window.gameNS.loadedState = {
    activeUnitInstanceId: null
};

window.gameNS.ui = window.gameNS.ui || {};

window.gameNS.destructionVideos = {
    "Comandos VZ": "vd/comandos_vz_abate.mp4",
    "Paraquedistas": "vd/paraquedistas_br_abate.mp4",
    "Infantaria Leve": "vd/infantaria_leve_abate.mp4",
    "GENERIC_TROPA": "vd/generico.mp4",
    "Avião caça": "vd/aviacaocaca.mp4",
    "Avião de Ataque leve": "vd/aviaocaca.mp4",
    "Helicópteros de ataque": "vd/helicoptero_ataque_generico.mp4",
    "Helicóptero de Ataque": "vd/helicoptero_ataque_generico.mp4",
    "Artilharia Autopropulsada": "vd/artilharia.mp4",
    "Artilharia Rebocada": "vd/artilharia.mp4",
    "Lançador Múltiplo de Foguetes": "vd/artilharia.mp4",
    "Tanque de Batalha": "vd/tanque.mp4",
    "VCI": "vd/veiculo_blindado_generico.mp4",
    "Viatura Blindada de Combate": "vd/veiculo_blindado_generico.mp4",
    "DEFAULT": "vd/generico.mp4"
};

window.gameNS.terrainTypeDescriptions = {
    "Floresta": "Área densamente arborizada. Oferece boa cobertura, mas pode dificultar o movimento de veículos pesados.",
    "Rio": "Curso de água natural. Intransponível para a maioria das unidades terrestres sem uma ponte. Essencial para unidades navais.",
    "Selva": "Vegetação extremamente densa e terreno difícil. Restringe severamente o movimento, ideal para emboscadas e infantaria especializada.",
    "Selva alta": "Selva com dossel elevado, oferecendo ainda mais ocultação e dificultando a observação aérea.",
    "Ponte": "Estrutura que permite a travessia de rios ou outros obstáculos. Ponto estratégico vital.",
    "Estrada": "Via pavimentada ou preparada que facilita o movimento rápido de unidades terrestres.",
    "Relevo": "Terreno acidentado como colinas ou montanhas baixas. Pode oferecer vantagens defensivas e de observação.",
    "Cidade": "Área urbana densa. Oferece excelente cobertura e posições defensivas, mas pode se tornar um labirinto em combate.",
    "Aeroporto": "Instalação crucial para operações aéreas, permitindo o pouso, decolagem e reabastecimento de aeronaves.",
    "Batalhão": "Base militar ou quartel. Ponto de partida ou objetivo estratégico importante.",
    "Planície": "Terreno aberto e relativamente plano. Favorece o movimento rápido e a visibilidade, mas oferece pouca cobertura.",
    "Mar": "Grande corpo de água salgada. Domínio de unidades navais e algumas operações aéreas."
};

window.gameNS.lastClickedHexCoord = null;
window.gameNS.highlightedActionHexes = [];
window.gameNS.logic = window.gameNS.logic || {};
window.gameNS.logic._visibleAttackTargets = [];
window.gameNS.isAiming = false;
window.gameNS.potentialAttackTargets = [];
window.gameNS.utils = window.gameNS.utils || {};

function applyAudioSettings() {
    if (!backgroundMusicPlayer) {
        backgroundMusicPlayer = document.getElementById('background-music-player');
        if (!backgroundMusicPlayer) {
            console.warn("Música: Elemento de áudio 'background-music-player' não encontrado ao aplicar configurações.");
            return;
        }
    }
    if (!window.gameNS.settings) {
        console.warn("Música: window.gameNS.settings não definido ao aplicar configurações de áudio.");
        return;
    }
    backgroundMusicPlayer.muted = window.gameNS.settings.musicMuted;
    let volume = parseFloat(window.gameNS.settings.musicVolume);
    if (isNaN(volume) || volume < 0) volume = 0;
    if (volume > 1) volume = 1;
    backgroundMusicPlayer.volume = volume;

    if (!window.gameNS.settings.musicMuted) {
        if (backgroundMusicPlayer.paused) {
            console.log("Música: Tentando tocar. Volume:", backgroundMusicPlayer.volume, "Mutado:", backgroundMusicPlayer.muted);
            backgroundMusicPlayer.play()
                .then(() => {
                    console.log("Música: Reprodução iniciada.");
                })
                .catch(error => {
                    console.warn("Música: Autoplay pode ter sido bloqueado ou erro ao tocar. Interação do usuário pode ser necessária.", error);
                });
        }
    } else {
        if (!backgroundMusicPlayer.paused) {
            console.log("Música: Pausando devido a estar mutado.");
            backgroundMusicPlayer.pause();
        }
    }
}

function saveSettings() {
    localStorage.setItem('gameSettings', JSON.stringify(window.gameNS.settings));
    applyAudioSettings();
}

function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        try {
            const parsedSettings = JSON.parse(savedSettings);
            window.gameNS.settings = { ...window.gameNS.settings, ...parsedSettings };
        } catch (e) {
            console.error("Erro ao parsear gameSettings do localStorage:", e);
        }
    }
    updateSettingsUI();
    applyAudioSettings();
}

function updateSettingsUI() {
    const musicOnOff = document.getElementById('setting-music-onoff');
    const musicVolume = document.getElementById('setting-music-volume');
    const sfxOnOff = document.getElementById('setting-sfx-onoff');
    const animationOnOff = document.getElementById('setting-animation-onoff');

    if (!window.gameNS.settings) return;

    if (musicOnOff) musicOnOff.checked = !window.gameNS.settings.musicMuted;
    if (musicVolume) {
        musicVolume.value = window.gameNS.settings.musicVolume;
        musicVolume.disabled = window.gameNS.settings.musicMuted;
    }
    if (sfxOnOff) sfxOnOff.checked = !window.gameNS.settings.sfxMuted;
    if (animationOnOff) {
        animationOnOff.checked = window.gameNS.settings.animationsEnabled;
        window.gameNS.morteAnimada = window.gameNS.settings.animationsEnabled; //
    }
}

function initializeSettingsControls() {
    backgroundMusicPlayer = document.getElementById('background-music-player');
    if (!backgroundMusicPlayer) {
        console.error("Música: Player 'background-music-player' não encontrado no DOM durante a inicialização dos controles de settings.");
    }

    const musicOnOff = document.getElementById('setting-music-onoff');
    const musicVolume = document.getElementById('setting-music-volume');
    const sfxOnOff = document.getElementById('setting-sfx-onoff');
    const animationOnOff = document.getElementById('setting-animation-onoff');

    if (musicOnOff) {
        musicOnOff.addEventListener('change', function() {
            window.gameNS.settings.musicMuted = !this.checked;
            saveSettings();
        });
    }
    if (musicVolume) {
        const applyVolumeChange = function() {
            window.gameNS.settings.musicVolume = parseFloat(this.value);
            saveSettings();
        };
        musicVolume.addEventListener('input', applyVolumeChange);
        musicVolume.addEventListener('change', applyVolumeChange);
    }
    if (sfxOnOff) {
        sfxOnOff.addEventListener('change', function() {
            window.gameNS.settings.sfxMuted = !this.checked;
            saveSettings();
        });
    }
    if (animationOnOff) {
        animationOnOff.addEventListener('change', function() {
            window.gameNS.settings.animationsEnabled = this.checked; //
            window.gameNS.morteAnimada = this.checked; //
            saveSettings();
        });
    }
    loadSettings();
}
window.gameNS.getPlacedUnitCountByType = function(originalUnitIdKey) {
    if (!window.gameNS.placedUnits || !originalUnitIdKey) { return 0; }
    let count = 0;
    for (const instanceId in window.gameNS.placedUnits) {
        if (window.gameNS.placedUnits[instanceId].originalUnitIdKey === originalUnitIdKey) {
            count++;
        }
    }
    return count;
};

window.gameNS.utils.getAlphaNumCoord = function(r, c) {
     if (r < 0 || c < 0) return null;
     return `${String.fromCharCode(65 + r)}${c + 1}`;
};

window.gameNS.utils.getHexagonSvgByCoord = function(alphaNumCoord) {
     if (!alphaNumCoord) return null;
     return document.querySelector(`#grid-container .hexagon-svg[data-alpha-num-coord="${alphaNumCoord}"]`);
};

window.gameNS.getUnitOnHex = function(hexCoord) {
     if (!hexCoord || !window.gameNS.placedUnits) return null;
     for (const instanceId in window.gameNS.placedUnits) {
         if (window.gameNS.placedUnits[instanceId].currentHex === hexCoord) {
             return instanceId;
         }
     }
     return null;
 };

 window.gameNS.isEnemyUnit = function(unitInstanceId1, unitInstanceId2) {
     const unit1 = window.gameNS.placedUnits[unitInstanceId1];
     const unit2 = window.gameNS.placedUnits[unitInstanceId2];
     if (!unit1 || !unit2) return false;
     return unit1.PAÍS !== unit2.PAÍS;
 };

 window.gameNS.calculateDistance = function(alphaNumCoord1, alphaNumCoord2) {
     if (alphaNumCoord1 === alphaNumCoord2) return 0;
     const hexSvg1 = window.gameNS.utils.getHexagonSvgByCoord(alphaNumCoord1);
     const hexSvg2 = window.gameNS.utils.getHexagonSvgByCoord(alphaNumCoord2);
     if (!hexSvg1 || !hexSvg2) return Infinity;
     const r1 = parseInt(hexSvg1.dataset.row); const c1 = parseInt(hexSvg1.dataset.col);
     const q1 = c1; const r_cube1 = r1 - Math.floor(c1 / 2); const s1 = -q1 - r_cube1;
     const r2 = parseInt(hexSvg2.dataset.row); const c2 = parseInt(hexSvg2.dataset.col);
     const q2 = c2; const r_cube2 = r2 - Math.floor(c2 / 2); const s2 = -q2 - r_cube2;
     return (Math.abs(q1 - q2) + Math.abs(r_cube1 - r_cube2) + Math.abs(s1 - s2)) / 2;
 };

 window.gameNS.getNeighborHexCoords = function(alphaNumCoord) {
      const hexSvg = window.gameNS.utils.getHexagonSvgByCoord(alphaNumCoord);
      if (!hexSvg) return [];
      const r_val = parseInt(hexSvg.dataset.row); const c_val = parseInt(hexSvg.dataset.col);
      const isOddRow = r_val % 2 !== 0;
      const neighborOffsets = [[0, -1], [0, 1],[-1, isOddRow ? 0 : -1], [-1, isOddRow ? 1 : 0],[1,  isOddRow ? 0 : -1], [1,  isOddRow ? 1 : 0]];
      const neighbors = [];
      const numRows = window.gameNS.config?.numRows; const hexPerRow = window.gameNS.config?.hexPerRow;
      if (numRows === undefined || hexPerRow === undefined) return [];
      for (const offset of neighborOffsets) {
          const nr = r_val + offset[0]; const nc = c_val + offset[1];
          if (nr >= 0 && nr < numRows && nc >= 0 && nc < hexPerRow) {
               const neighborAlphaNum = window.gameNS.utils.getAlphaNumCoord(nr, nc);
               if(neighborAlphaNum) neighbors.push(neighborAlphaNum);
          }
      }
      return neighbors;
  };

window.gameNS.getHexesInDistance = function(startHexAlphaNum, distance) {
    if (!startHexAlphaNum || distance < 0) return [];
    if (!window.gameNS.config) return [];
    if (typeof window.gameNS.getNeighborHexCoords !== 'function') return [];
    let reachable = new Set([startHexAlphaNum]);
    let queue = [{coord: startHexAlphaNum, dist: 0}];
    let visited = new Set([startHexAlphaNum]);
    while(queue.length > 0){
        let curr = queue.shift();
        if(curr.dist < distance){
             let neighbors = window.gameNS.getNeighborHexCoords(curr.coord);
             for(let neighbor of neighbors){
                 const newDist = curr.dist + 1;
                 if(!visited.has(neighbor)){
                     visited.add(neighbor);
                     if (newDist <= distance) {
                          reachable.add(neighbor);
                           if (newDist < distance) queue.push({coord: neighbor, dist: newDist});
                     }
                 }
             }
        }
    }
    return Array.from(reachable);
};

window.gameNS.loadGameStateFromLocalStorage = function() {
    console.log("%c[LOAD GAME] Tentando carregar estado do jogo (autosave) do localStorage...", "color: #007bff; font-weight: bold;");
    const savedStateString = localStorage.getItem('savedGameState');
    if (!savedStateString) {
        console.log("[LOAD GAME] Nenhum estado de jogo (autosave) encontrado com a chave 'savedGameState'.");
        return false;
    }
    try {
        const savedState = JSON.parse(savedStateString);
        if (savedState && savedState.mapFile && savedState.placedUnits && savedState.unitInstanceCounters) { //
            window.gameNS.gameState = savedState; //
            // Sincroniza currentGameInfo APÓS gameState ser carregado
            window.gameNS.currentGameInfo = { ...window.gameNS.gameState }; //
            window.gameNS.placedUnits = window.gameNS.gameState.placedUnits || {}; //
            window.gameNS.unitInstanceCounters = window.gameNS.gameState.unitInstanceCounters || {}; //
            window.gameNS.loadedState.activeUnitInstanceId = window.gameNS.gameState.activeUnitInstanceId || null; //
            window.gameNS.gameState.gameModeBeenSetThisSession = true; //

            console.log("%c[LOAD GAME] Estado do jogo (autosave) carregado com sucesso de 'savedGameState'!", "color: lightgreen;");
            return true;
        } else {
            console.warn("[LOAD GAME] Estado de jogo (autosave) 'savedGameState' encontrado, mas está incompleto ou corrompido.");
            localStorage.removeItem('savedGameState'); //
            return false;
        }
    } catch (error) {
        console.error("[LOAD GAME] Erro ao parsear ou restaurar o estado do jogo (autosave) 'savedGameState':", error);
        localStorage.removeItem('savedGameState'); //
        return false;
    }
};

window.gameNS.clearActionHighlights = function() {
    if (Array.isArray(window.gameNS.highlightedActionHexes)) {
        window.gameNS.highlightedActionHexes.forEach(hexPoly => {
            if (hexPoly && typeof hexPoly.setAttribute === 'function') {
                hexPoly.setAttribute('fill', window.gameNS.config.hexFillColor);
                hexPoly.style.stroke = window.gameNS.config.hexStrokeColor || "rgba(0,0,0,0.15)";
                hexPoly.style.strokeWidth = (window.gameNS.config.hexStrokeWidth || 1).toString() + "px";
            }
        });
    }
    window.gameNS.highlightedActionHexes = [];
    const rangeIndicatorCircle = document.getElementById('range-indicator-circle');
    if (rangeIndicatorCircle) rangeIndicatorCircle.remove();
    document.querySelectorAll('.attack-target-icon').forEach(icon => icon.remove()); //
    if (window.gameNS.logic?._clearCombatVisualsState) { //
        window.gameNS.logic._clearCombatVisualsState(); //
    } else {
         window.gameNS.isAiming = false; //
         window.gameNS.potentialAttackTargets = []; //
         if (window.gameNS.logic) window.gameNS.logic._visibleAttackTargets = []; //
    }
};

window.gameNS.switchSidebarView = function(viewName) {
    const assetInfoSection = document.getElementById('selected-asset-info');
    const resourceSection = document.getElementById('resource-section');
    const terrainInfoSection = document.getElementById('selected-terrain-info');
    const settingsSection = document.getElementById('settings-section');
    const statusTurnSection = document.getElementById('status-turn-section');

    const assetPlaceholder = document.getElementById('selected-asset-placeholder');
    const terrainPlaceholder = document.getElementById('selected-terrain-placeholder');

    const iconPlayButton = document.getElementById('icon-play');
    const iconTerrainInfoButton = document.getElementById('icon-terrain-info');
    const iconStatusTurnButton = document.getElementById('icon-status-turn');
    const iconHelpConfigButton = document.getElementById('icon-help-config');
    const iconMenuStoryButton = document.getElementById('icon-menu-story');
    const gameSidebar = document.getElementById('game-sidebar');

    if (assetInfoSection) assetInfoSection.classList.add('hidden');
    if (resourceSection) resourceSection.classList.add('hidden');
    if (terrainInfoSection) terrainInfoSection.classList.add('hidden');
    if (settingsSection) settingsSection.classList.add('hidden');
    if (statusTurnSection) statusTurnSection.classList.add('hidden');

    if (assetPlaceholder) assetPlaceholder.style.display = 'none';
    if (terrainPlaceholder) terrainPlaceholder.style.display = 'none';

    document.querySelectorAll('#icon-action-bar .icon-bar-button').forEach(btn => btn.classList.remove('active-icon-bar-button'));

    if (viewName === 'play') {
        if (assetInfoSection) assetInfoSection.classList.remove('hidden');
        if (resourceSection) resourceSection.classList.remove('hidden');
        iconPlayButton?.classList.add('active-icon-bar-button');
        const selectedAssetDetails = document.getElementById('selected-asset-details');
         if (selectedAssetDetails?.classList.contains('hidden') && assetPlaceholder) {
            assetPlaceholder.style.display = 'flex';
        } else if (assetPlaceholder && selectedAssetDetails && !selectedAssetDetails.classList.contains('hidden')) {
            assetPlaceholder.style.display = 'none';
        } else if (assetPlaceholder && !selectedAssetDetails) {
            assetPlaceholder.style.display = 'flex';
        }
    } else if (viewName === 'terrain') {
        if(terrainInfoSection) terrainInfoSection.classList.remove('hidden');
        iconTerrainInfoButton?.classList.add('active-icon-bar-button');
        if (window.gameNS.lastClickedHexCoord) {
            document.getElementById('selected-terrain-details')?.classList.remove('hidden');
            if (terrainPlaceholder) terrainPlaceholder.style.display = 'none';
            window.gameNS.populateTerrainInfo(window.gameNS.lastClickedHexCoord);
        } else {
            if (terrainPlaceholder) terrainPlaceholder.style.display = 'flex';
            document.getElementById('selected-terrain-details')?.classList.add('hidden');
        }
    } else if (viewName === 'status') {
        if (statusTurnSection) statusTurnSection.classList.remove('hidden');
        iconStatusTurnButton?.classList.add('active-icon-bar-button');
        window.gameNS.loadAndDisplayGameInfo();
    } else if (viewName === 'help') {
        iconHelpConfigButton?.classList.add('active-icon-bar-button');
    } else if (viewName === 'settings') {
        if (settingsSection) settingsSection.classList.remove('hidden');
        iconMenuStoryButton?.classList.add('active-icon-bar-button');
    }

    const shouldShowSidebar = (viewName === 'play' || viewName === 'terrain' || viewName === 'settings' || viewName === 'status');
    if (gameSidebar && !gameSidebar.classList.contains('visible') && shouldShowSidebar) {
        window.toggleGameSidebarGL?.(true);
    }
};

window.gameNS.loadAndDisplayGameInfo = function() {
    // ... (seu código existente para difficulty, currentPlayerName, currentPlayerCountry, playerCountryFlagImg, gameTurnDisplay) ...
    // Verifique se window.gameNS.gameState existe antes de usá-lo
    if (!window.gameNS.gameState) {
        console.warn("[loadAndDisplayGameInfo] gameState não definido. Informações da sidebar não podem ser totalmente carregadas.");
        // Preencher com N/A ou traços se o gameState não estiver pronto
        document.getElementById('sidebar-current-player-name-display').textContent = '--';
        // ... etc. para outros campos ...
        return;
    }
    const currentGame = window.gameNS.gameState;

    // Seu código para informações do TURNO ATUAL (mantenha e verifique)
    document.getElementById('sidebar-current-player-name-display').textContent = currentGame.currentPlayerName || '--';
    document.getElementById('sidebar-current-player-country-display').textContent = currentGame.currentPlayerCountry || '--';
    const playerCountryFlagImg = document.getElementById('sidebar-player-country-flag');
    if (playerCountryFlagImg) {
        const flagSrc = (window.gameNS.countryFlags && window.gameNS.countryFlags[currentGame.currentPlayerCountry?.toUpperCase()]) || (window.gameNS.countryFlags && window.gameNS.countryFlags["DEFAULT"]);
        if (flagSrc && currentGame.currentPlayerCountry && currentGame.currentPlayerCountry !== 'N/A') {
            playerCountryFlagImg.src = flagSrc;
            playerCountryFlagImg.alt = `Bandeira ${currentGame.currentPlayerCountry}`;
            playerCountryFlagImg.style.display = 'inline-block';
        } else {
            playerCountryFlagImg.style.display = 'none';
        }
    }
    document.getElementById('sidebar-game-turn-display').textContent = currentGame.currentTurn || '1';
    // ... (seu código para dificuldade) ...


    // --- INÍCIO DA INTEGRAÇÃO PARA "VOCÊ É:" ---
    const localNameDisplay = document.getElementById('sidebar-local-player-name-display');
    const localCountryTextDisplay = document.getElementById('sidebar-local-player-country-display');
    const localFlagDisplay = document.getElementById('sidebar-local-player-country-flag');

    // window.gameNS.localPlayerActualName e window.gameNS.localPlayerActualCountry
    // devem ser definidos no script inline de roraima_online.html a partir dos parâmetros da URL.
    if (localNameDisplay && window.gameNS.localPlayerActualName) {
        localNameDisplay.textContent = window.gameNS.localPlayerActualName;
    } else if (localNameDisplay) {
        localNameDisplay.textContent = 'Você (Nome Desc.)'; // Fallback
    }

    if (localCountryTextDisplay && window.gameNS.localPlayerActualCountry) {
        localCountryTextDisplay.textContent = window.gameNS.localPlayerActualCountry;
    } else if (localCountryTextDisplay) {
        localCountryTextDisplay.textContent = 'País Desc.'; // Fallback
    }

    if (localFlagDisplay) {
        if (window.gameNS.localPlayerActualCountry && window.gameNS.localPlayerActualCountry !== "País Desconhecido" && window.gameNS.localPlayerActualCountry !== "N/A") {
            const localUserFlagFile = window.gameNS.localPlayerActualCountry.toLowerCase().replace(/\s+/g, '_') + '.svg';
            localFlagDisplay.src = `img/flags/${localUserFlagFile}`; // Certifique-se que o caminho e nomes de arquivo estão corretos
            localFlagDisplay.alt = `Sua Bandeira: ${window.gameNS.localPlayerActualCountry}`;
            localFlagDisplay.style.display = 'inline-block';
        } else {
            localFlagDisplay.style.display = 'none'; // Esconde se o país não for válido ou conhecido
        }
    }
    // --- FIM DA INTEGRAÇÃO PARA "VOCÊ É:" ---

    console.log("[UI-LAYOUT loadAndDisplayGameInfo] Info da partida exibida na sidebar (lida de gameState):", JSON.parse(JSON.stringify(currentGame)));
};



// --- Funções para exibir e resetar vídeo de abate ---
window.gameNS.ui.showDestructionVideo = function(videoPath) {
    const videoPlayerContainer = document.getElementById('video-player-container');
    const videoPlayer = document.getElementById('destruction-video-player');
    const videoPlaceholder = document.getElementById('destruction-video-placeholder');

    if (!videoPlayer || !videoPlayerContainer || !videoPlaceholder) {
        console.error("Elementos do player de vídeo (destruction-video-player, video-player-container, destruction-video-placeholder) não encontrados na sidebar.");
        return;
    }

    console.log(`[UI-VIDEO] Tentando exibir vídeo na sidebar: ${videoPath}`);
    window.gameNS.switchSidebarView('status');

    videoPlayer.src = videoPath;
    videoPlayerContainer.classList.remove('hidden');
    videoPlaceholder.classList.add('hidden');

    videoPlayer.load();
    videoPlayer.play()
        .then(() => {
            console.log(`[UI-VIDEO] Vídeo ${videoPath} iniciado na sidebar.`);
        })
        .catch(error => {
            console.error(`[UI-VIDEO] Erro ao tentar reproduzir o vídeo ${videoPath} na sidebar:`, error);
            videoPlayerContainer.classList.add('hidden');
            videoPlaceholder.classList.remove('hidden');
        });

    videoPlayer.onended = function() {
        console.log(`[UI-VIDEO] Vídeo ${videoPath} terminado na sidebar.`);
        videoPlayerContainer.classList.add('hidden');
        videoPlaceholder.classList.remove('hidden');
        videoPlayer.src = "";
    };
};

window.gameNS.ui.resetDestructionVideoArea = function() {
    const videoPlayerContainer = document.getElementById('video-player-container');
    const videoPlayer = document.getElementById('destruction-video-player');
    const videoPlaceholder = document.getElementById('destruction-video-placeholder');

    if (videoPlayer) {
        if (!videoPlayer.paused) {
            videoPlayer.pause();
        }
        videoPlayer.src = "";
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
    }
    if (videoPlayerContainer) videoPlayerContainer.classList.add('hidden');
    if (videoPlaceholder) videoPlaceholder.classList.remove('hidden');
    console.log("[UI-VIDEO] Área do vídeo de abate na sidebar resetada.");
};
// ----------------------------------------------------

/**
 * Displays the game over popup.
 * @param {string} title - The title for the game over screen.
 * @param {string} message - The message to display.
 * @param {string} videoPath - Path to the video to be played.
 */
window.gameNS.ui.showGameOverPopup = function(title, message, videoPath) {
    const popupGameOver = document.getElementById('popup-game-over');
    const gameOverTitleElem = document.getElementById('game-over-title');
    const gameOverMessageElem = document.getElementById('game-over-message');
    const gameOverVideoPlayer = document.getElementById('game-over-video-player');
    const gameOverVideoContainer = document.getElementById('game-over-video-container');
    const btnExitToMenu = document.getElementById('btn-exit-to-menu');

    if (!popupGameOver || !gameOverTitleElem || !gameOverMessageElem || !gameOverVideoPlayer || !gameOverVideoContainer || !btnExitToMenu) {
        console.error("Um ou mais elementos do popup de fim de jogo não foram encontrados.");
        // Fallback alert if critical elements are missing
        alert(`Fim de Jogo!\nTítulo: ${title}\nMensagem: ${message}`);
        return;
    }

    // Clear any previous content/state
    gameOverVideoPlayer.pause();
    gameOverVideoPlayer.removeAttribute('src'); // Important to ensure new video loads
    gameOverVideoPlayer.load(); // Reset the player

    gameOverTitleElem.textContent = title;
    gameOverMessageElem.textContent = message;

    if (videoPath && typeof videoPath === 'string' && videoPath.trim() !== '') {
        gameOverVideoPlayer.src = videoPath;
        gameOverVideoContainer.classList.remove('hidden'); // Ensure it's visible
        gameOverVideoPlayer.load(); // Load the new source
        const playPromise = gameOverVideoPlayer.play();

        if (playPromise !== undefined) {
            playPromise.then(_ => {
                // Autoplay started
                console.log(`[FIM DE JOGO POPUP] Vídeo ${videoPath} iniciado.`);
            }).catch(error => {
                // Autoplay was prevented.
                console.warn(`[FIM DE JOGO POPUP] Autoplay do vídeo ${videoPath} bloqueado. Controles podem ser necessários.`, error);
                // You might want to show controls explicitly or a play button if autoplay fails
            });
        }
    } else {
        console.warn("[FIM DE JOGO POPUP] Nenhum videoPath válido fornecido. Ocultando container de vídeo.");
        gameOverVideoContainer.classList.add('hidden');
    }

    popupGameOver.classList.remove('popup-hidden');

    btnExitToMenu.onclick = () => {
        // Potentially add cleanup here, like stopping music or other game processes
        window.location.href = 'menu.html'; // Navigate to main menu
    };

    // Stop background music if it's playing
    if (backgroundMusicPlayer && !backgroundMusicPlayer.paused) {
        backgroundMusicPlayer.pause();
        console.log("[FIM DE JOGO POPUP] Música de fundo pausada.");
    }
};


    function populateUnitInfo(instanceIdToDisplay, isSelectionFromMap = true) {
        const selectedAssetPlaceholder = document.getElementById('selected-asset-placeholder');
        const selectedAssetDetails = document.getElementById('selected-asset-details');
        const unitInfoImage = document.getElementById('unit-info-image');
        const unitInfoNameDisplay = document.getElementById('unit-info-name');
        const unitInfoPais = document.getElementById('unit-info-pais');
        const unitInfoCustoOP = document.getElementById('unit-info-custoop');
        const unitInfoValor = document.getElementById('unit-info-valor');
        const unitInfoDescription = document.getElementById('unit-info-description');
        const unitInfoInstanceIdDisplay = document.getElementById('unit-info-instance-id');
        const unitInfoSquadCountDisplay = document.getElementById('unit-info-squad-count');

        const offensiveModeCheckbox = document.getElementById('offensive-mode-checkbox');
        const offensiveModeControlWrapper = document.getElementById('offensive-mode-control-wrapper');
        const btnShowRangeMov = document.getElementById('btn-show-range-mov');

        const unitInfoAttack = document.getElementById('unit-info-attack');
        const unitInfoHealth = document.getElementById('unit-info-health');
        const unitInfoMovement = document.getElementById('unit-info-movement');
        const unitInfoRange = document.getElementById('unit-info-range');

        let unitInstanceData = null;
        let unitBaseData = null;
        let determinedInstanceId = null;
        let originalUnitIdKey = null;

        const currentPlayerCountry = window.gameNS.gameState.currentPlayerCountry; //
        const gameIsOver = window.gameNS.gameState && window.gameNS.gameState.isGameOver;


        if (isSelectionFromMap && window.gameNS.activeUnitForAction?.unitIdKey === instanceIdToDisplay) {
            determinedInstanceId = instanceIdToDisplay;
            unitInstanceData = window.gameNS.activeUnitForAction.unitInstanceData;
            if (!unitInstanceData) {
                console.error(`populateUnitInfo: unitInstanceData nulo para activeUnitForAction (ID: ${instanceIdToDisplay})`);
                clearSidebarDetails(); return;
            }
            originalUnitIdKey = unitInstanceData.originalUnitIdKey;
            unitBaseData = window.gameNS.cardProperties[originalUnitIdKey];
            if (!unitBaseData) { clearSidebarDetails(); return; }
            setActiveMapToken(determinedInstanceId);
        } else if (!isSelectionFromMap && instanceIdToDisplay) {
            originalUnitIdKey = instanceIdToDisplay;
            unitBaseData = window.gameNS.cardProperties[originalUnitIdKey];
            if (!unitBaseData) { clearSidebarDetails(); return; }
            determinedInstanceId = null; unitInstanceData = null;
            if (offensiveModeCheckbox) { offensiveModeCheckbox.disabled = true; offensiveModeCheckbox.checked = false;}
            if (offensiveModeControlWrapper) { offensiveModeControlWrapper.title = "Selecione uma unidade no mapa para ações"; }
            if (btnShowRangeMov) { btnShowRangeMov.disabled = true; btnShowRangeMov.style.opacity = 0.5; btnShowRangeMov.title = "Selecione uma unidade no mapa para ações"; }
        } else {
            clearSidebarDetails(); return;
        }


        if (selectedAssetPlaceholder) selectedAssetPlaceholder.style.display = 'none';
        if (selectedAssetDetails) selectedAssetDetails.classList.remove('hidden');

        if (unitInfoNameDisplay) unitInfoNameDisplay.textContent = unitBaseData["NOME"] || 'N/A';

        if (unitInfoInstanceIdDisplay) {
            if (determinedInstanceId && unitInstanceData) {
                const friendlySuffix = unitInstanceData.friendlySuffix;
                unitInfoInstanceIdDisplay.textContent = friendlySuffix ? `#${friendlySuffix}` : `#${determinedInstanceId.substring(determinedInstanceId.length - 6).toUpperCase()}`;
            } else {
                unitInfoInstanceIdDisplay.textContent = '--';
            }
        }
        if (unitInfoSquadCountDisplay) {
            if (originalUnitIdKey) {
                const baseDataForCount = window.gameNS.cardProperties[originalUnitIdKey];
                const maxQuantityFromSquad = parseInt(baseDataForCount?.["ESQUADRAS"]);
                const currentPlacedCount = window.gameNS.getPlacedUnitCountByType(originalUnitIdKey);
                const hasLimit = !isNaN(maxQuantityFromSquad) && maxQuantityFromSquad > 0;

                if (hasLimit) {
                    unitInfoSquadCountDisplay.textContent = `${currentPlacedCount}/${maxQuantityFromSquad}`;
                }
                else {
                    unitInfoSquadCountDisplay.textContent = (baseDataForCount?.["ESQUADRAS"] === undefined || baseDataForCount?.["ESQUADRAS"] === "" || isNaN(maxQuantityFromSquad) ) ? 'N/D' : 'Ilimitado';
                }
            } else {
                unitInfoSquadCountDisplay.textContent = '--';
            }
        }


        if (unitInfoImage) {
            let imageUrl = unitBaseData["IMAGEM"];
            if (imageUrl && typeof imageUrl === 'string') {
                if (imageUrl.includes('drive.google.com')) {
                    const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
                    imageUrl = (fileIdMatch && fileIdMatch[1]) ? `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}` : 'https://placehold.co/240x180/1f2937/9ca3af?text=Link+GInv';
                } else if (!imageUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                    imageUrl = 'https://placehold.co/240x180/1f2937/9ca3af?text=Formato+Inv';
                }
            } else { imageUrl = 'https://placehold.co/240x180/1f2937/9ca3af?text=Sem+Imagem'; }
            unitInfoImage.src = imageUrl.trim();
            unitInfoImage.onerror = function() { this.src = 'https://placehold.co/240x180/1f2937/9ca3af?text=Erro+Img'; };
        }

        if (unitInfoPais) unitInfoPais.textContent = unitBaseData["PAÍS"] || '--';
        if (unitInfoAttack) unitInfoAttack.textContent = unitBaseData["PODER DE FOGO"] != null ? unitBaseData["PODER DE FOGO"] : '0';

        if (unitInfoHealth) {
            unitInfoHealth.textContent = (unitInstanceData?.currentBlindagem !== undefined) ? unitInstanceData.currentBlindagem : (unitBaseData["BLINDAGEM"] ?? '0');
        }
        if (unitInfoMovement) {
            unitInfoMovement.textContent = (unitInstanceData?.currentMovimento !== undefined) ? unitInstanceData.currentMovimento : (unitBaseData["DESLOCAMENTO"] ?? '0');
        }
        if (unitInfoRange) {
            unitInfoRange.textContent = (unitInstanceData?.currentAlcance !== undefined) ? unitInstanceData.currentAlcance : (unitBaseData["ALCANCE"] ?? '0');
        }

        if (unitInfoCustoOP) unitInfoCustoOP.textContent = unitBaseData["CUSTO OP"] ?? '--';
        if (unitInfoValor) unitInfoValor.textContent = unitBaseData["VALOR"] ?? '--';
        if (unitInfoDescription) unitInfoDescription.textContent = unitBaseData["OBS"] || 'Sem descrição.';


        const isUnitActiveAndSelectedFromMap = isSelectionFromMap && window.gameNS.activeUnitForAction?.unitIdKey === determinedInstanceId && unitInstanceData;
        const isPlayersUnit = isUnitActiveAndSelectedFromMap ? unitInstanceData.PAÍS === currentPlayerCountry : false;

        if (offensiveModeCheckbox && offensiveModeControlWrapper) {
            let offensiveModeCanBeActivated = false;
            let offensiveModeAttackRange = 0;

            if (isUnitActiveAndSelectedFromMap && unitBaseData && unitInstanceData) {
                const hasBaseAttack = parseInt(unitBaseData["PODER DE FOGO"] || 0) > 0; //
                offensiveModeAttackRange = parseInt(unitInstanceData.currentAlcance !== undefined ? unitInstanceData.currentAlcance : (unitBaseData.ALCANCE || 0)); //
                offensiveModeCanBeActivated = isPlayersUnit && hasBaseAttack && offensiveModeAttackRange > 0 && !unitInstanceData.hasAttackedThisTurn; //
            }

            offensiveModeCheckbox.disabled = !offensiveModeCanBeActivated || gameIsOver; // Added gameIsOver check

            const isCurrentlyAimingWithThisUnit = window.gameNS.isAiming &&
                                            window.gameNS.activeUnitForAction?.unitIdKey === determinedInstanceId;

            if (offensiveModeCanBeActivated && !gameIsOver) {
                offensiveModeCheckbox.checked = isCurrentlyAimingWithThisUnit;
                offensiveModeControlWrapper.title = isCurrentlyAimingWithThisUnit ? "Desativar Modo Ofensivo" : "Ativar Modo Ofensivo";
            } else {
                offensiveModeCheckbox.checked = false;
                 if (gameIsOver) {
                    offensiveModeControlWrapper.title = "O jogo terminou";
                } else if (!isUnitActiveAndSelectedFromMap) {
                    offensiveModeControlWrapper.title = "Selecione uma unidade no mapa";
                } else if (!isPlayersUnit) {
                    offensiveModeControlWrapper.title = "Não é sua unidade";
                } else if (unitInstanceData?.hasAttackedThisTurn) { //
                    offensiveModeControlWrapper.title = "Já atacou neste turno"; //
                } else if (parseInt(unitBaseData?.["PODER DE FOGO"] || 0) <= 0) { //
                    offensiveModeControlWrapper.title = "Sem poder de fogo"; //
                } else if (offensiveModeAttackRange <= 0) { //
                    offensiveModeControlWrapper.title = "Sem alcance de ataque"; //
                } else {
                    offensiveModeControlWrapper.title = "Não pode ativar modo ofensivo";
                }
            }

            if (offensiveModeCheckbox._changeHandler) {
                offensiveModeCheckbox.removeEventListener('change', offensiveModeCheckbox._changeHandler);
            }

            const handleChangeOffensiveMode = () => {
                if (offensiveModeCheckbox.disabled) return; // Already handles gameIsOver
                if (window.gameNS.activeUnitForAction?.unitIdKey === determinedInstanceId) {
                    const activeContext = window.gameNS.activeUnitForAction;
                    if (!activeContext.unitInstanceData || !activeContext.unitData) { return; }

                    if (activeContext.unitInstanceData.hasAttackedThisTurn && offensiveModeCheckbox.checked) { //
                        alert("Esta unidade já atacou neste turno e não pode entrar em modo ofensivo.");
                        offensiveModeCheckbox.checked = false;
                        window.gameNS.isAiming = false;
                        offensiveModeControlWrapper.title = "Já atacou neste turno";
                        return;
                    }
                    const currentAttackRangeVal = parseInt(activeContext.unitInstanceData.currentAlcance !== undefined ? activeContext.unitInstanceData.currentAlcance : (activeContext.unitData.ALCANCE || 0) ); //
                    const baseAttackVal = parseInt(activeContext.unitData["PODER DE FOGO"] || 0); //
                    if ((baseAttackVal <= 0 || currentAttackRangeVal <= 0) && offensiveModeCheckbox.checked) { //
                        alert(`Unidade ${activeContext.unitData?.NOME || ''} não pode entrar em modo ofensivo.`);
                        offensiveModeCheckbox.checked = false;
                        offensiveModeControlWrapper.title = (baseAttackVal <= 0) ? "Sem poder de fogo" : "Sem alcance de ataque";
                        return;
                    }

                    if (offensiveModeCheckbox.checked) {
                        if (window.gameNS.isAiming && window.gameNS.activeUnitForAction?.unitIdKey !== determinedInstanceId) {
                            window.gameNS.cancelAimingMode?.(); //
                        }
                        if (window.gameNS.clearActionHighlights) window.gameNS.clearActionHighlights();
                        if (typeof window.showRangeIndicator === 'function' && activeContext.originalHexWrapper) {
                            window.showRangeIndicator(activeContext.originalHexWrapper, currentAttackRangeVal, 'mira');
                        }
                        if(window.gameNS.logic?.showAttackOptionsForUnit) { //
                            window.gameNS.logic.showAttackOptionsForUnit(determinedInstanceId); //
                            offensiveModeControlWrapper.title = "Desativar Modo Ofensivo";
                        } else {
                            window.gameNS.clearActionHighlights?.();
                            offensiveModeCheckbox.checked = false;
                            offensiveModeControlWrapper.title = "Erro ao ativar modo";
                        }
                    } else {
                        if (window.gameNS.isAiming) {
                        window.gameNS.cancelAimingMode?.(); //
                        } else {
                            window.gameNS.clearActionHighlights?.();
                        }
                        offensiveModeCheckbox.checked = false;
                        offensiveModeControlWrapper.title = "Ativar Modo Ofensivo";
                    }
                } else {
                    alert("Unidade ativa dessincronizada.");
                    window.gameNS.clearUnitInfo?.(); //
                    if(offensiveModeCheckbox) offensiveModeCheckbox.checked = false;
                    if(offensiveModeControlWrapper) offensiveModeControlWrapper.title = "Selecione uma unidade no mapa";
                }
            };

            offensiveModeCheckbox.addEventListener('change', handleChangeOffensiveMode);
            offensiveModeCheckbox._changeHandler = handleChangeOffensiveMode;
        }


        if (btnShowRangeMov) {
            let movCanMove = false;
            let movMovementPoints = 0;

            if (isUnitActiveAndSelectedFromMap && unitBaseData && unitInstanceData) {
                const hasBaseMovement = parseInt(unitBaseData["DESLOCAMENTO"] || 0) > 0; //
                movMovementPoints = parseInt(unitInstanceData.currentMovimento !== undefined ? unitInstanceData.currentMovimento : (unitBaseData.DESLOCAMENTO || 0)); //
                movCanMove = isPlayersUnit && hasBaseMovement && movMovementPoints > 0 && !unitInstanceData.hasMovedThisTurn && !window.gameNS.isAiming; //
            }

            btnShowRangeMov.disabled = !movCanMove || gameIsOver; // Added gameIsOver check
            btnShowRangeMov.style.opacity = btnShowRangeMov.disabled ? 0.5 : 1;

            if (gameIsOver) {
                btnShowRangeMov.title = "O jogo terminou";
            } else {
                 btnShowRangeMov.title = btnShowRangeMov.disabled ?
                                    (window.gameNS.isAiming && isUnitActiveAndSelectedFromMap ? "Desative o Modo Ofensivo para mover" :
                                    (!isUnitActiveAndSelectedFromMap ? "Selecione uma unidade no mapa" :
                                    (!isPlayersUnit ? "Não é sua unidade" :
                                    (unitInstanceData?.hasMovedThisTurn ? "Já moveu neste turno" : //
                                        (parseInt(unitBaseData?.["DESLOCAMENTO"] || 0) <= 0 ? "Sem deslocamento base" : //
                                        (movMovementPoints <= 0 ? "Sem pontos de movimento" : "Impossível mover agora (verifique outras condições)")))))) //
                                    : "Mostrar alcance de movimento";
            }


            btnShowRangeMov.onclick = null;
            if (!btnShowRangeMov.disabled && determinedInstanceId && !window.gameNS.isAiming) { //
                btnShowRangeMov.onclick = () => {
                    if (window.gameNS.activeUnitForAction?.unitIdKey === determinedInstanceId) {
                        const activeContext = window.gameNS.activeUnitForAction;
                        if (!activeContext.unitInstanceData || !activeContext.unitData) { return; }
                        if (activeContext.unitInstanceData.hasMovedThisTurn) { alert("Esta unidade já se moveu."); return; } //
                        if (window.gameNS.isAiming) { alert("Desative o Modo Ofensivo para poder mover a unidade."); return; } //
                        const currentMovementVal = parseInt(activeContext.unitInstanceData.currentMovimento !== undefined ? activeContext.unitInstanceData.currentMovimento : (activeContext.unitData.DESLOCAMENTO || 0)); //
                        const baseMovementVal = parseInt(activeContext.unitData["DESLOCAMENTO"] || 0); //
                        if (isNaN(currentMovementVal) || currentMovementVal <= 0 || baseMovementVal <= 0) { alert(`Unidade não pode mover.`); return; }
                        if (window.gameNS.clearActionHighlights) window.gameNS.clearActionHighlights();
                        if (typeof window.gameNS.displayMovementRangeVisual === 'function') { //
                            window.gameNS.displayMovementRangeVisual(); //
                        } else {
                            window.gameNS.clearActionHighlights?.();
                            populateUnitInfo(determinedInstanceId, true);
                        }
                    } else { alert("Unidade ativa dessincronizada."); window.gameNS.clearUnitInfo?.(); }
                };
            }
        }
    }

    function setActiveMapToken(instanceUnitId) {
        document.querySelectorAll('.unit-map-token.selected-map-token').forEach(selectedToken => {
            selectedToken.classList.remove('selected-map-token');
        });
        if (instanceUnitId) {
            const currentToken = document.querySelector(`.unit-map-token[data-token-id="${instanceUnitId}"]`);
            if (currentToken) {
                currentToken.classList.add('selected-map-token');
            }
        }
    }

    window.gameNS.clearUnitInfo = function() {
        window.gameNS.activeUnitForAction = null;
        setActiveMapToken(null);
        if (window.gameNS.clearActionHighlights) {
            window.gameNS.clearActionHighlights();
        }
        clearSidebarDetails();
    };

    function clearSidebarDetails() {
        const assetDetails = document.getElementById('selected-asset-details');
        const assetPlaceholder = document.getElementById('selected-asset-placeholder');
        if (assetDetails) assetDetails.classList.add('hidden');

        const iconPlayButton = document.getElementById('icon-play');
        if (assetPlaceholder) {
            if (iconPlayButton?.classList.contains('active-icon-bar-button') && !window.gameNS.activeUnitForAction) {
                assetPlaceholder.style.display = 'flex';
            } else {
                assetPlaceholder.style.display = 'none';
            }
        }

        const unitInfoNameDisplay = document.getElementById('unit-info-name');
        if(unitInfoNameDisplay) unitInfoNameDisplay.textContent = '--';
        const unitInfoInstanceIdDisplay = document.getElementById('unit-info-instance-id');
        if (unitInfoInstanceIdDisplay) unitInfoInstanceIdDisplay.textContent = '--';
        const unitInfoPais = document.getElementById('unit-info-pais');
        if(unitInfoPais) unitInfoPais.textContent = '--';
        const unitInfoAttack = document.getElementById('unit-info-attack');
        if(unitInfoAttack) unitInfoAttack.textContent = '--';
        const unitInfoHealth = document.getElementById('unit-info-health');
        if(unitInfoHealth) unitInfoHealth.textContent = '--';
        const unitInfoMovement = document.getElementById('unit-info-movement');
        if(unitInfoMovement) unitInfoMovement.textContent = '--';
        const unitInfoRange = document.getElementById('unit-info-range');
        if(unitInfoRange) unitInfoRange.textContent = '--';
        const unitInfoSquadCountDisplay = document.getElementById('unit-info-squad-count');
        if (unitInfoSquadCountDisplay) unitInfoSquadCountDisplay.textContent = '--';
        const unitInfoCustoOP = document.getElementById('unit-info-custoop');
        if(unitInfoCustoOP) unitInfoCustoOP.textContent = '--';
        const unitInfoValor = document.getElementById('unit-info-valor');
        if(unitInfoValor) unitInfoValor.textContent = '--';
        const unitInfoDescription = document.getElementById('unit-info-description');
        if(unitInfoDescription) unitInfoDescription.textContent = '--';
        const unitInfoImage = document.getElementById('unit-info-image');
        if (unitInfoImage) { unitInfoImage.src = 'https://placehold.co/240x180/1f2937/9ca3af?text=Unidade'; unitInfoImage.alt = 'Imagem da Unidade';}

        const terrainDetails = document.getElementById('selected-terrain-details');
        const terrainPlaceholder = document.getElementById('selected-terrain-placeholder');
        const iconTerrainInfoButton = document.getElementById('icon-terrain-info');
        if (terrainDetails) terrainDetails.classList.add('hidden');
        if (terrainPlaceholder) {
            if (iconTerrainInfoButton?.classList.contains('active-icon-bar-button')) {
                terrainPlaceholder.style.display = 'flex';
            } else {
                terrainPlaceholder.style.display = 'none';
            }
        }

        const offensiveModeCheckbox = document.getElementById('offensive-mode-checkbox');
        const offensiveModeControlWrapper = document.getElementById('offensive-mode-control-wrapper');
        if (offensiveModeCheckbox) {
            offensiveModeCheckbox.checked = false;
            offensiveModeCheckbox.disabled = true;
            if (offensiveModeCheckbox._changeHandler) {
                offensiveModeCheckbox.removeEventListener('change', offensiveModeCheckbox._changeHandler);
                delete offensiveModeCheckbox._changeHandler;
            }
        }
        if (offensiveModeControlWrapper) {
            offensiveModeControlWrapper.title = "Selecione uma unidade no mapa para ações";
        }
        const btnShowRangeMov = document.getElementById('btn-show-range-mov');
        if(btnShowRangeMov) {
            btnShowRangeMov.disabled = true;
            btnShowRangeMov.style.opacity = 0.5;
            btnShowRangeMov.title = "Selecione uma unidade no mapa para ações";
            btnShowRangeMov.onclick = null;
        }
    }

    window.gameNS.populateTerrainInfo = function(alphaNumCoord) {
        const terrainDetails = document.getElementById('selected-terrain-details');
        const terrainPlaceholder = document.getElementById('selected-terrain-placeholder');
        const terrainData = window.gameNS.terrainData[alphaNumCoord];
        if (!terrainData) {
            if (terrainPlaceholder) terrainPlaceholder.style.display = 'flex';
            if (terrainDetails) terrainDetails.classList.add('hidden');
            return;
        }
        if (terrainPlaceholder) terrainPlaceholder.style.display = 'none';
        if (terrainDetails) terrainDetails.classList.remove('hidden');
        const geografia = terrainData.Geografia || 'N/A';
        const terrainInfoNameElem = document.getElementById('terrain-info-name');
        if(terrainInfoNameElem) terrainInfoNameElem.textContent = geografia;
        const terrainDescElem = document.getElementById('terrain-info-description-text');
        if(terrainDescElem) terrainDescElem.textContent = window.gameNS.terrainTypeDescriptions[geografia] || 'Descrição não disponível.';
        const terrainImageElement = document.getElementById('terrain-info-image');
        if (terrainImageElement) {
            const imageName = geografia.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '') + '.png';
            terrainImageElement.src = `img/terrain/${imageName}`;
            terrainImageElement.alt = geografia;
            terrainImageElement.onerror = function() { this.src = 'https://placehold.co/300x180/1f2937/9ca3af?text=' + encodeURIComponent(geografia); this.alt = 'Imagem não encontrada';};
        }
        const terrainInfoCoordElem = document.getElementById('terrain-info-coord');
        if(terrainInfoCoordElem) terrainInfoCoordElem.textContent = alphaNumCoord;
        const terrainInfoGeografiaElem = document.getElementById('terrain-info-geografia');
        if(terrainInfoGeografiaElem) terrainInfoGeografiaElem.textContent = geografia;
        const terrainInfoCustoMovElem = document.getElementById('terrain-info-custo-mov');
        if(terrainInfoCustoMovElem) terrainInfoCustoMovElem.textContent = terrainData.CustoMovHex !== undefined && terrainData.CustoMovHex !== null ? terrainData.CustoMovHex : '1 (Padrão)'; //
        const terrainInfoModDeslocElem = document.getElementById('terrain-info-mod-desloc');
        if(terrainInfoModDeslocElem) terrainInfoModDeslocElem.textContent = terrainData.Deslocamento != 0 && terrainData.Deslocamento != null ? `${terrainData.Deslocamento > 0 ? '+' : ''}${terrainData.Deslocamento}` : 'Nenhum'; //
        const terrainInfoModVisibElem = document.getElementById('terrain-info-mod-visib');
        if(terrainInfoModVisibElem) terrainInfoModVisibElem.textContent = terrainData.Visibilidade != 0 && terrainData.Visibilidade != null ? `${terrainData.Visibilidade > 0 ? '+' : ''}${terrainData.Visibilidade}` : 'Nenhum'; //
        const terrainInfoModAlcanceElem = document.getElementById('terrain-info-mod-alcance');
        if(terrainInfoModAlcanceElem) terrainInfoModAlcanceElem.textContent = terrainData.Alcance != 0 && terrainData.Alcance != null ? `${terrainData.Alcance > 0 ? '+' : ''}${terrainData.Alcance}` : 'Nenhum'; //
        const terrainInfoDominioElem = document.getElementById('terrain-info-dominio');
        if(terrainInfoDominioElem) terrainInfoDominioElem.textContent = terrainData.DominadoPor || 'Nenhum'; //
        const terrainInfoObsElem = document.getElementById('terrain-info-obs');
        if(terrainInfoObsElem) terrainInfoObsElem.textContent = (terrainData.OBS && terrainData.OBS.trim().toUpperCase() !== "TERRESTRE" && terrainData.OBS.trim().toUpperCase() !== "TODOS") ? terrainData.OBS : '--'; //
    };

    window.gameNS.applyFilters = function() {
        const filterForcaSelect = document.getElementById('filter-forca-select');
        const filterCategoriaSelect = document.getElementById('filter-categoria-select');
        if (!filterForcaSelect || !filterCategoriaSelect) {
            console.warn("[UI-LAYOUT applyFilters] Filtros não encontrados, tentando popular resource menu sem filtros.");
            window.gameNS.populateResourceMenu({});
            return;
        }
        const filters = {
            forca: filterForcaSelect.value,
            categoria: filterCategoriaSelect.value,
        };
        window.gameNS.populateResourceMenu(filters);
    };

    window.gameNS.populateResourceMenu = function(filters = {}) {
        const resourceList = document.getElementById('resource-list');
        if (!resourceList) { console.error("[UI-LAYOUT populateResourceMenu] #resource-list não encontrado."); return; }
        resourceList.innerHTML = '';
        const allUnits = window.gameNS.cardProperties;
        const activePlayerCountry = window.gameNS.gameState.currentPlayerCountryForResourceFilter; //

        if (!activePlayerCountry || activePlayerCountry === 'N/A') { //
            console.error("[UI-LAYOUT populateResourceMenu] Erro: País do jogador (currentPlayerCountryForResourceFilter) não definido no gameState para filtro de recursos.");
            resourceList.innerHTML = '<p class="text-gray-500 text-center py-4">Erro: País do jogador não definido para filtro.</p>';
            return;
        }

        let filteredUnitsArray = Object.entries(allUnits).filter(([key, unitData]) => {
            return unitData && unitData["PAÍS"] === activePlayerCountry;
        });
        if (filters.forca && filters.forca !== "todos") {
            filteredUnitsArray = filteredUnitsArray.filter(([key, unitData]) => unitData && unitData["FORÇA"] === filters.forca);
        }
        if (filters.categoria && filters.categoria !== "todos") {
            filteredUnitsArray = filteredUnitsArray.filter(([key, unitData]) => unitData && unitData["CATEGORIA"] === filters.categoria);
        }

        if (filteredUnitsArray.length === 0) {
            resourceList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum recurso encontrado.</p>';
        } else {
            filteredUnitsArray.sort(([,a], [,b]) => (a.NOME || '').localeCompare(b.NOME || '')).forEach(([originalUnitIdKey, unitData]) => {
                if (!unitData) return;
                const maxQuantityFromSquad = parseInt(unitData["ESQUADRAS"]);
                const currentPlacedCount = window.gameNS.getPlacedUnitCountByType(originalUnitIdKey);
                const hasLimit = !isNaN(maxQuantityFromSquad) && maxQuantityFromSquad > 0;
                const canPlaceMore = !hasLimit || currentPlacedCount < maxQuantityFromSquad;

                const cardDiv = document.createElement('div');
                cardDiv.className = `resource-card mb-2 shadow hover:shadow-md rounded-md ${canPlaceMore ? 'cursor-grab' : 'cursor-not-allowed resource-card-disabled'}`;
                cardDiv.setAttribute('draggable', canPlaceMore ? 'true' : 'false');
                cardDiv.id = `resource-${originalUnitIdKey}`;
                cardDiv.dataset.unitKey = originalUnitIdKey;

                let imageUrl = unitData["IMAGEM"]?.trim() || 'https://placehold.co/80x60/1f2937/9ca3af?text=S/Img';
                if (imageUrl.includes('drive.google.com')) {
                    const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
                    imageUrl = (fileIdMatch && fileIdMatch[1]) ? `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}` : 'https://placehold.co/80x60/1f2937/9ca3af?text=InvG';
                }
                cardDiv.style.backgroundImage = `url('${imageUrl}')`;

                let titleText = unitData["NOME"] || originalUnitIdKey;
                if (hasLimit) titleText += ` (${currentPlacedCount}/${maxQuantityFromSquad})`;
                if (!canPlaceMore && hasLimit) titleText += " - LIMITE ATINGIDO";
                cardDiv.title = titleText;

                const infoOverlay = document.createElement('div');
                infoOverlay.className = 'resource-card-info-overlay';
                const nameLabel = document.createElement('p');
                nameLabel.textContent = unitData["NOME"] || originalUnitIdKey;
                if (hasLimit) nameLabel.textContent += ` (${currentPlacedCount}/${maxQuantityFromSquad})`;
                infoOverlay.appendChild(nameLabel);
                cardDiv.appendChild(infoOverlay);

                cardDiv.addEventListener('click', () => {
                    populateUnitInfo(originalUnitIdKey, false);
                    window.gameNS.switchSidebarView('play');
                });

                if (canPlaceMore) {
                    cardDiv.addEventListener('dragstart', (event) => {
                        if (window.gameNS.gameState && window.gameNS.gameState.isGameOver) {
                            event.preventDefault();
                            return;
                        }
                        const originalCardEl = event.target.closest('.resource-card');
                        if (originalCardEl && originalCardEl.getAttribute('draggable') === 'true') {
                            event.dataTransfer.setData('text/plain', originalCardEl.dataset.unitKey);
                            event.dataTransfer.setData('source', 'resource-list');
                            originalCardEl.classList.add('dragging');
                        } else {
                            event.preventDefault();
                        }
                    });
                }
                cardDiv.addEventListener('dragend', (event) => {
                    const originalCardEl = event.target.closest('.resource-card');
                    if (originalCardEl) originalCardEl.classList.remove('dragging');
                });
                resourceList.appendChild(cardDiv);
            });
        }
    };


    window.gameNS.populateForcaFilter = function(playerCountry) {
        const units = window.gameNS.cardProperties;
        const filterForcaSelect = document.getElementById('filter-forca-select');
        if (!units || Object.keys(units).length === 0 || !filterForcaSelect) {
            if(filterForcaSelect) filterForcaSelect.innerHTML = '<option value="todos">Todas as Forças</option>';
            console.warn("[UI-LAYOUT populateForcaFilter] Sem dados de unidades ou select de força não encontrado.");
            return;
        }
        const forcas = new Set();
        Object.values(units).forEach(unitData => {
            if (unitData && unitData["FORÇA"] && (!playerCountry || playerCountry === 'N/A' || unitData["PAÍS"] === playerCountry)) {
                forcas.add(unitData["FORÇA"]);
            }
        });
        filterForcaSelect.innerHTML = '<option value="todos">Todas as Forças</option>';
        Array.from(forcas).sort().forEach(forca => {
            const option = document.createElement('option');
            option.value = forca; option.textContent = forca;
            filterForcaSelect.appendChild(option);
        });
        filterForcaSelect.value = "todos";
    };

    window.gameNS.updateCategoriaFilter = function(selectedForca) {
        const playerCountryForFilter = window.gameNS.gameState.currentPlayerCountryForResourceFilter; //
        const units = window.gameNS.cardProperties;
        const filterCategoriaSelect = document.getElementById('filter-categoria-select');

        if (!units || !filterCategoriaSelect || Object.keys(units).length === 0) {
            if(filterCategoriaSelect) filterCategoriaSelect.innerHTML = '<option value="todos">Todas as Categorias</option>';
            console.warn("[UI-LAYOUT updateCategoriaFilter] Sem dados de unidades ou select de categoria não encontrado.");
            return;
        }

        if (!playerCountryForFilter || playerCountryForFilter === 'N/A') { //
            console.warn("[UI-LAYOUT updateCategoriaFilter] País do jogador (currentPlayerCountryForResourceFilter) não definido no gameState. Filtro de categoria pode estar incompleto.");
        }

        const categorias = new Set();
        Object.values(units).forEach(unitData => {
            if (unitData && (!playerCountryForFilter || playerCountryForFilter === 'N/A' || unitData["PAÍS"] === playerCountryForFilter)) { //
                if (selectedForca === "todos" || (unitData["FORÇA"] === selectedForca)) {
                    if (unitData["CATEGORIA"]) categorias.add(unitData["CATEGORIA"]);
                }
            }
        });
        filterCategoriaSelect.innerHTML = '<option value="todos">Todas as Categorias</option>';
        Array.from(categorias).sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat; option.textContent = cat;
            filterCategoriaSelect.appendChild(option);
        });
        filterCategoriaSelect.value = "todos";
    };

    async function loadUnitData() {
        try {
            const unitsResponse = await fetch('csvjson.json');
            if (!unitsResponse.ok) throw new Error(`HTTP error unidades! ${unitsResponse.status}`);
            const unitsData = await unitsResponse.json();
            window.gameNS.cardProperties = unitsData;
            console.log("[UI-LAYOUT loadUnitData] Dados das unidades (cardProperties) carregados.");

            const terrainResponse = await fetch('Terreno.json');
            if (!terrainResponse.ok) throw new Error(`HTTP error terreno! ${terrainResponse.status}`);
            const terrainDataLoaded = await terrainResponse.json();
            window.gameNS.terrainData = terrainDataLoaded;
            console.log("[UI-LAYOUT loadUnitData] Dados do terreno (terrainData) carregados.");

        } catch (error) {
            console.error("Falha crítica ao carregar dados essenciais (unidades/terreno):", error);
            alert("Falha grave ao iniciar o jogo. Não foi possível carregar dados essenciais. Verifique o console.");
            throw error;
        }
    }

    const SVG_NS = "http://www.w3.org/2000/svg";
    window.showRangeIndicator = function(hexWrapperElement, rangeValue, type = 'mira') {
        const existingIndicator = document.getElementById('range-indicator-circle');
        if (existingIndicator) existingIndicator.remove();
        const range = Number(rangeValue);
        if (isNaN(range) || !hexWrapperElement || range < 0) return;
        if (range === 0 && type !== 'mira') return; //
        if (range === 0 && type === 'mira' && parseInt(window.gameNS.activeUnitForAction?.unitData?.["PODER DE FOGO"] || 0) <=0 ) return; //

        const config = window.gameNS.config;
        if (!config || typeof config.hexWidth !== 'number' || config.hexWidth <= 0) {
            console.warn("Configuração do hexágono inválida para showRangeIndicator.");
            return;
        }

        const diameter = config.hexWidth * (1 + (2 * range));
        const indicator = document.createElement('div');
        indicator.id = 'range-indicator-circle';
        Object.assign(indicator.style, {
            position: 'absolute', pointerEvents: 'none', zIndex: '15',
            width: `${diameter}px`, height: `${diameter}px`,
            left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            backgroundColor: type === 'mira' ? 'rgba(255,0,0,0.10)' : 'rgba(0,149,64,0.10)', //
            border: type === 'mira' ? `2px dashed rgba(220,38,38,0.6)` : `2px dashed rgba(22,163,74,0.6)`, //
            boxShadow: `0 0 8px ${type==='mira'?'rgba(255,0,0,0.5)':'rgba(0,149,64,0.5)'}`, //
        });
        hexWrapperElement.appendChild(indicator);
    };

    window.gameNS.rebuildPlacedUnitsOnMap = function() {
    const localPlayerIDForLog = window.gameNS.localPlayerKey || 'UI-RBUR'; // Para logs
    console.log(`%c[${localPlayerIDForLog} - rebuildPlacedUnitsOnMap] INICIANDO RECONSTRUÇÃO DE UNIDADES NO MAPA.`, "color: blue; font-weight: bold;");
    console.log(`%c[${localPlayerIDForLog} - rebuildPlacedUnitsOnMap] window.gameNS.placedUnits ATUAL:`, "color: purple;", JSON.parse(JSON.stringify(window.gameNS.placedUnits || {})));
    console.log(`%c[${localPlayerIDForLog} - rebuildPlacedUnitsOnMap] window.gameNS.cardProperties CARREGADO? ${window.gameNS.cardProperties && Object.keys(window.gameNS.cardProperties).length > 0}`, "color: purple;");
    // FIM DAS LINHAS A SEREM ADICIONADAS
        console.log("[UI-LAYOUT rebuildPlacedUnitsOnMap] Reconstruindo unidades no mapa a partir do estado salvo...");
        if (!window.gameNS.placedUnits || Object.keys(window.gameNS.placedUnits).length === 0) { //
            console.log("[UI-LAYOUT rebuildPlacedUnitsOnMap] Nenhuma unidade para reconstruir.");
            return;
        }
        const gridContainer = document.getElementById('grid-container');
        if (!gridContainer) {
            console.error("[UI-LAYOUT rebuildPlacedUnitsOnMap] gridContainer não encontrado.");
            return;
        }

        for (const instanceId in window.gameNS.placedUnits) { //
            const unitInstance = window.gameNS.placedUnits[instanceId]; //
            const unitBaseData = window.gameNS.cardProperties[unitInstance.originalUnitIdKey]; //
            console.log(`%c[${localPlayerIDForLog} - rebuildPlacedUnitsOnMap] Processando unidade: ${instanceId}`, "color: teal;", unitInstance);


            if (!unitInstance || !unitBaseData || !unitInstance.currentHex) { //
                console.warn(`[UI-LAYOUT rebuildPlacedUnitsOnMap] Dados inválidos para unidade ${instanceId}. Pulando.`);
                continue;
                console.warn(`%c[${localPlayerIDForLog} - rebuildPlacedUnitsOnMap] Instância ${instanceId} inválida ou sem originalUnitIdKey. Pulando.`, "color:orange;", unitInstance || 'Instance is null/undefined');
                continue;

            }

            const targetHexSvg = window.gameNS.utils.getHexagonSvgByCoord(unitInstance.currentHex); //
            if (!targetHexSvg) {
                console.warn(`[UI-LAYOUT rebuildPlacedUnitsOnMap] Hexágono SVG para ${unitInstance.currentHex} não encontrado. Unidade ${instanceId} não pode ser colocada.`); //
                continue;
                console.warn(`%c[${localPlayerIDForLog} - rebuildPlacedUnitsOnMap] Unidade ${instanceId} ("${unitInstance.NOME || unitBaseData.NOME}") não possui currentHex. Pulando.`, "color:orange;");
                continue;

            }
            console.log(`%c[${localPlayerIDForLog} - rebuildPlacedUnitsOnMap] Tentando encontrar hexWrapper para ${unitInstance.currentHex} (unidade ${instanceId})`, "color: teal;");
            const targetHexWrapperElem = targetHexSvg.closest('.hexagon-wrapper');
            let targetHexContentOverlayElem = targetHexWrapperElem?.querySelector('.hexagon-content-overlay');
            
            if (!targetHexContentOverlayElem && targetHexWrapperElem) {
                targetHexContentOverlayElem = document.createElement('div');
                targetHexContentOverlayElem.className = 'hexagon-content-overlay';
                Object.assign(targetHexContentOverlayElem.style, {
                    position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none'
                });
                targetHexWrapperElem.appendChild(targetHexContentOverlayElem);
            }
            if (!targetHexContentOverlayElem) continue;

            const unitName = unitBaseData["NOME"] || unitInstance.originalUnitIdKey; //
            let unitImageSrc = unitBaseData["IMAGEM"]?.trim() || 'https://placehold.co/38x52/1f2937/9ca3af?text=S/Img';
            if (unitImageSrc.includes('drive.google.com')) {
                const fileIdMatch = unitImageSrc.match(/\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
                unitImageSrc = (fileIdMatch && fileIdMatch[1]) ? `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}` : 'https://placehold.co/38x52/1f2937/9ca3af?text=LnkInv';
            }

            const unitToken = document.createElement('div');
            unitToken.className = 'unit-map-token';
            unitToken.dataset.originalCardId = unitInstance.originalUnitIdKey; //
            unitToken.dataset.tokenId = instanceId;
            unitToken.title = `${unitName} #${unitInstance.friendlySuffix || instanceId.substring(instanceId.length - 4)}`; //
            unitToken.setAttribute('draggable', 'true');

            unitToken.addEventListener('mousedown', (event) => event.stopPropagation() );
            unitToken.addEventListener('dragstart', (de) => {
                if (window.gameNS.gameState && window.gameNS.gameState.isGameOver) {
                    de.preventDefault();
                    return;
                }
                de.stopPropagation();
                const draggedToken = de.target.closest('.unit-map-token');
                if (!draggedToken) { de.preventDefault(); return; }
                const currentInstanceId = draggedToken.dataset.tokenId;

                const unitToDragInstanceData = window.gameNS.placedUnits[currentInstanceId]; //
                if (!unitToDragInstanceData || unitToDragInstanceData.PAÍS !== window.gameNS.gameState.currentPlayerCountry) { //
                    console.warn(`[UI-LAYOUT DragStart] Tentativa de arrastar unidade (${currentInstanceId}) que não pertence ao jogador atual (${window.gameNS.gameState.currentPlayerName}).`); //
                    alert("Você só pode mover suas próprias unidades.");
                    de.preventDefault();
                    return;
                }

                if (typeof window.gameNS.clearUnitInfo === 'function') window.gameNS.clearUnitInfo(); //
                if (typeof window.gameNS.prepareUnitForAction === 'function') {
                    window.gameNS.prepareUnitForAction(currentInstanceId, draggedToken);
                } else { de.preventDefault(); return; }
                setActiveMapToken(currentInstanceId);
                if (window.gameNS.activeUnitForAction?.unitInstanceData?.hasMovedThisTurn) { //
                    alert("Esta unidade já se moveu neste turno."); //
                    de.preventDefault(); return;
                }
                if (window.gameNS.isAiming) { //
                    alert("Desative o Modo Ofensivo para mover a unidade."); //
                    de.preventDefault(); return;
                }
                de.dataTransfer.setData('text/plain', currentInstanceId);
                de.dataTransfer.setData('source', 'map-token');
                draggedToken.classList.add('dragging-map-token');
                if (typeof window.gameNS.displayMovementRangeVisual === 'function' && //
                    (!window.gameNS.activeUnitForAction?.unitInstanceData?.hasMovedThisTurn)) { //
                    window.gameNS.displayMovementRangeVisual(); //
                }
            });
            unitToken.addEventListener('dragend', (de) => {
                const draggedToken = de.target.closest('.unit-map-token');
                if (draggedToken) draggedToken.classList.remove('dragging-map-token');
            });
            unitToken.addEventListener('click', (ev) => {
                if (window.gameNS.gameState && window.gameNS.gameState.isGameOver) {
                    console.log("O jogo terminou. Apenas visualização de unidade permitida.");
                    // Optionally allow info display but no actions:
                    // const clickedTokenItself = ev.currentTarget;
                    // const currentInstanceId = clickedTokenItself.dataset.tokenId;
                    // populateUnitInfo(currentInstanceId, true); // populateUnitInfo will disable actions
                    return; // Or completely block if preferred
                }
                ev.stopPropagation();
                const clickedTokenItself = ev.currentTarget;
                const currentInstanceId = clickedTokenItself.dataset.tokenId;
                const unitClickedInstanceData = window.gameNS.placedUnits[currentInstanceId]; //
                if (unitClickedInstanceData) { //
                    if (window.gameNS.activeUnitForAction?.unitIdKey === currentInstanceId && !window.gameNS.isAiming) { //
                        window.gameNS.clearUnitInfo(); //
                    } else {
                        if (typeof window.gameNS.clearUnitInfo === 'function') window.gameNS.clearUnitInfo(); //
                        if (unitClickedInstanceData.PAÍS === window.gameNS.gameState.currentPlayerCountry) { //
                            if (typeof window.gameNS.prepareUnitForAction === 'function') {
                                window.gameNS.prepareUnitForAction(currentInstanceId, clickedTokenItself);
                            }
                        } else {
                            console.log(`[UI-LAYOUT Click] Unidade inimiga ${currentInstanceId} selecionada para visualização.`);
                            window.gameNS.activeUnitForAction = {
                                unitIdKey: currentInstanceId,
                                unitData: window.gameNS.cardProperties[unitClickedInstanceData.originalUnitIdKey], //
                                originalUnitIdKey: unitClickedInstanceData.originalUnitIdKey, //
                                originalHexWrapper: clickedTokenItself.closest('.hexagon-wrapper'),
                                unitTokenElement: clickedTokenItself,
                                unitInstanceData: unitClickedInstanceData
                            };
                            setActiveMapToken(currentInstanceId);
                        }
                        populateUnitInfo(currentInstanceId, true);
                        window.gameNS.switchSidebarView('play');
                    }
                }
            });
            const unitImgElement = document.createElement('img');
            unitImgElement.src = unitImageSrc; unitImgElement.alt = unitName;
            unitImgElement.onerror = function() { this.src = 'https://placehold.co/38x52/cc0000/ffffff?text=X'; this.alt = 'Erro Img'; };
            unitToken.appendChild(unitImgElement);
            if (unitInstance.isDamaged) { //
                unitToken.classList.add('is-damaged'); //
            }
            targetHexContentOverlayElem.innerHTML = '';
            targetHexContentOverlayElem.appendChild(unitToken);
        }
    };

    document.addEventListener('DOMContentLoaded', async () => {
        
        console.log("[UI-LAYOUT DOMContentLoaded] Iniciado.");
        const gameSidebar = document.getElementById('game-sidebar');
        const sidebarToggleButton = document.getElementById('sidebar-toggle-button');
        const gridContainer = document.getElementById('grid-container');
        const gameBoard = document.getElementById('game-board');
        const iconPlayButton = document.getElementById('icon-play');
        const iconTerrainInfoButton = document.getElementById('icon-terrain-info');
        const iconStatusTurnButton = document.getElementById('icon-status-turn');
        const iconHelpConfigButton = document.getElementById('icon-help-config');
        const iconMenuStoryButton = document.getElementById('icon-menu-story');

        const initialNumRows = 19; const initialHexPerRow = 23;
        const initialHexWidth = 50; const initialHexHeight = 57.74;
        const initialHexPoints = [`${initialHexWidth/2},0`, `${initialHexWidth},${initialHexHeight/4}`, `${initialHexWidth},${(initialHexHeight*3)/4}`, `${initialHexWidth/2},${initialHexHeight}`, `0,${(initialHexHeight*3)/4}`, `0,${initialHexHeight/4}`].join(" ");

        window.gameNS.config = window.gameNS.config || {};
        Object.assign(window.gameNS.config, {
            numRows: window.gameNS.config.numRows ?? initialNumRows,
            hexPerRow: window.gameNS.config.hexPerRow ?? initialHexPerRow,
            hexWidth: window.gameNS.config.hexWidth ?? initialHexWidth,
            hexHeight: window.gameNS.config.hexHeight ?? initialHexHeight,
            hexPoints: window.gameNS.config.hexPoints || initialHexPoints,
            hexFillColor: window.gameNS.config.hexFillColor || "rgba(0,0,0,0.071)",
            hexStrokeColor: window.gameNS.config.hexStrokeColor || "rgba(0,0,0,0.15)",
            hexStrokeWidth: window.gameNS.config.hexStrokeWidth || 1,
            hexFillColorHover: window.gameNS.config.hexFillColorHover || "rgba(0,0,0,0.2)",
            hexFillColorMoveValid: window.gameNS.config.hexFillColorMoveValid || 'rgba(0, 255, 0, 0.25)',
            hexStrokeColorMoveValid: window.gameNS.config.hexStrokeColorMoveValid || '#009900',
            hexFillColorInvalid: window.gameNS.config.hexFillColorInvalid || "rgba(255,0,0,0.3)",
        });
        window.gameNS.allPolygons = {};

        if (iconPlayButton) iconPlayButton.addEventListener('click', () => window.gameNS.switchSidebarView('play'));
        if (iconTerrainInfoButton) iconTerrainInfoButton.addEventListener('click', () => window.gameNS.switchSidebarView('terrain'));
        if (iconStatusTurnButton) iconStatusTurnButton.addEventListener('click', () => window.gameNS.switchSidebarView('status'));
        if (iconHelpConfigButton) iconHelpConfigButton.addEventListener('click', () => window.gameNS.switchSidebarView('help'));
        if (iconMenuStoryButton) iconMenuStoryButton.addEventListener('click', () => window.gameNS.switchSidebarView('settings'));

        window.toggleGameSidebarGL = function(forceShow) {
            if (gameSidebar) {
                const isVisible = gameSidebar.classList.contains('visible');
                let newVisibilityState = (typeof forceShow === 'boolean') ? forceShow : !isVisible;
                gameSidebar.classList.toggle('visible', newVisibilityState);
                updateSidebarToggleButton();
            }
        }
        function updateSidebarToggleButton() {
            if (sidebarToggleButton && gameSidebar) {
                const isVisible = gameSidebar.classList.contains('visible');
                sidebarToggleButton.innerHTML = isVisible ? '&#9654;' : '&#9664;';
                sidebarToggleButton.title = isVisible ? 'Fechar Painel' : 'Abrir Painel';
                const sidebarWidth = gameSidebar.offsetWidth;
                sidebarToggleButton.style.right = isVisible ? `${sidebarWidth}px` : '0px';
                sidebarToggleButton.style.zIndex = '1001';
            }
        }
        if (sidebarToggleButton) sidebarToggleButton.addEventListener('click', () => window.toggleGameSidebarGL());

        window.createHexGrid = function() {
            if (!gridContainer) { console.error("[UI-LAYOUT createHexGrid] ERRO: gridContainer é null."); return; }
            gridContainer.innerHTML = '';
            window.gameNS.allPolygons = {};
            const currentConfig = window.gameNS.config;
            for (let r = 0; r < currentConfig.numRows; r++) {
                const rowDiv = document.createElement('div');
                rowDiv.classList.add('hex-row');
                for (let c = 0; c < currentConfig.hexPerRow; c++) {
                    const hexWrapper = document.createElement('div');
                    hexWrapper.classList.add('hexagon-wrapper');
                    const svgHex = document.createElementNS(SVG_NS, "svg");
                    svgHex.setAttribute('class', 'hexagon-svg');
                    svgHex.setAttribute('width', String(currentConfig.hexWidth));
                    svgHex.setAttribute('height', String(currentConfig.hexHeight));
                    svgHex.setAttribute("viewBox", `0 0 ${currentConfig.hexWidth} ${currentConfig.hexHeight}`);
                    const alphaNumCoord = window.gameNS.utils.getAlphaNumCoord(r, c);
                    svgHex.dataset.row = r.toString();
                    svgHex.dataset.col = c.toString();
                    if (alphaNumCoord) svgHex.dataset.alphaNumCoord = alphaNumCoord;
                    const polygon = document.createElementNS(SVG_NS, "polygon");
                    polygon.setAttribute('points', currentConfig.hexPoints);
                    polygon.setAttribute('fill', currentConfig.hexFillColor);
                    polygon.setAttribute('stroke', currentConfig.hexStrokeColor);
                    polygon.setAttribute('stroke-width', String(currentConfig.hexStrokeWidth));
                    svgHex.appendChild(polygon);
                    if(alphaNumCoord) window.gameNS.allPolygons[alphaNumCoord] = polygon;
                    let contentOverlay = hexWrapper.querySelector('.hexagon-content-overlay');
                    if(!contentOverlay) {
                        contentOverlay = document.createElement('div');
                        contentOverlay.className = 'hexagon-content-overlay';
                        Object.assign(contentOverlay.style, {
                            position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            pointerEvents: 'none'
                        });
                        hexWrapper.appendChild(contentOverlay);
                    }
                    svgHex.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        if (window.gameNS?.showHexInfo && alphaNumCoord) { //
                            window.gameNS.showHexInfo(e.pageX, e.pageY, svgHex.dataset.row, svgHex.dataset.col, alphaNumCoord); //
                        }
                    });
                    svgHex.addEventListener('click', (e) => {
                        const clickedHexSvg = e.currentTarget;
                        const clickedAlphaNumCoord = clickedHexSvg.dataset.alphaNumCoord;
                        if (!clickedAlphaNumCoord) return;
                        window.gameNS.lastClickedHexCoord = clickedAlphaNumCoord;
                        const clickedHexWrapper = clickedHexSvg.closest('.hexagon-wrapper');
                        const clickedUnitToken = clickedHexWrapper?.querySelector('.hexagon-content-overlay .unit-map-token');

                        if (window.gameNS?.hideHexInfo) window.gameNS.hideHexInfo(); //

                        if (window.gameNS.isAiming) { //
                            if (typeof window.gameNS.cancelAimingMode === 'function') { //
                                window.gameNS.cancelAimingMode(); //
                            }
                            if (window.gameNS.activeUnitForAction?.unitIdKey) { //
                                populateUnitInfo(window.gameNS.activeUnitForAction.unitIdKey, true); //
                            }
                            return;
                        }

                        const settingsSection = document.getElementById('settings-section');
                        const statusTurnSect = document.getElementById('status-turn-section');
                        const terrainInfoSect = document.getElementById('selected-terrain-info');

                        let nonPlaySidebarTabActive = (settingsSection && !settingsSection.classList.contains('hidden')) ||
                                                    (statusTurnSect && !statusTurnSect.classList.contains('hidden')) ||
                                                    (terrainInfoSect && !terrainInfoSect.classList.contains('hidden') && !iconPlayButton?.classList.contains('active-icon-bar-button'));


                        if (clickedUnitToken) {
                             if (window.gameNS.gameState && window.gameNS.gameState.isGameOver) {
                                console.log("O jogo terminou. Apenas visualização de unidade permitida.");
                                const instanceId = clickedUnitToken.dataset.tokenId;
                                populateUnitInfo(instanceId, true); // populateUnitInfo will disable actions
                                window.gameNS.switchSidebarView('play');
                                return;
                            }
                            const instanceId = clickedUnitToken.dataset.tokenId;
                            const unitClickedInstanceData = window.gameNS.placedUnits[instanceId]; //

                            if (window.gameNS.activeUnitForAction?.unitIdKey === instanceId) { //
                                window.gameNS.clearUnitInfo(); //
                            } else {
                                if (typeof window.gameNS.clearUnitInfo === 'function') window.gameNS.clearUnitInfo(); //
                                if (unitClickedInstanceData && unitClickedInstanceData.PAÍS === window.gameNS.gameState.currentPlayerCountry) { //
                                    if (typeof window.gameNS.prepareUnitForAction === 'function') {
                                        window.gameNS.prepareUnitForAction(instanceId, clickedUnitToken);
                                    }
                                } else if (unitClickedInstanceData) { //
                                    console.log(`[UI-LAYOUT Click] Unidade ${instanceId} (${unitClickedInstanceData.NOME || 'Nome Desconhecido'}) não pertence ao jogador atual (${window.gameNS.gameState.currentPlayerName}). Apenas visualização.`); //
                                    window.gameNS.activeUnitForAction = { //
                                        unitIdKey: instanceId, //
                                        unitData: window.gameNS.cardProperties[unitClickedInstanceData.originalUnitIdKey], //
                                        originalUnitIdKey: unitClickedInstanceData.originalUnitIdKey, //
                                        originalHexWrapper: clickedUnitToken.closest('.hexagon-wrapper'), //
                                        unitTokenElement: clickedUnitToken, // Typo, should be clickedUnitToken, but used clickedTokenItself earlier which is ev.currentTarget. Corrected.
                                        unitInstanceData: unitClickedInstanceData //
                                    };
                                    setActiveMapToken(instanceId); //
                                }
                                populateUnitInfo(instanceId, true);
                                window.gameNS.switchSidebarView('play');
                            }
                        } else {
                            if (nonPlaySidebarTabActive) {
                                if (iconTerrainInfoButton?.classList.contains('active-icon-bar-button')) {
                                    window.gameNS.populateTerrainInfo(clickedAlphaNumCoord);
                                }
                            } else {
                                if (window.gameNS.activeUnitForAction) { //
                                    window.gameNS.clearUnitInfo(); //
                                } else {
                                    if (window.gameNS.clearActionHighlights) window.gameNS.clearActionHighlights();
                                }
                                window.gameNS.populateTerrainInfo(clickedAlphaNumCoord);
                                window.gameNS.switchSidebarView('terrain');
                            }
                        }
                    });
                    svgHex.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        const polygonElem = e.currentTarget.querySelector('polygon');
                        if (!polygonElem) return;
                        let source = "";
                        if (e.dataTransfer) { try { source = e.dataTransfer.getData('source') || ""; } catch (err) {} }
                        const isHighlightedForMovement = window.gameNS.highlightedActionHexes.includes(polygonElem);
                        const unitTokenBeingDragged = window.gameNS.activeUnitForAction?.unitTokenElement;
                        const hexWrapperElem = e.currentTarget.closest('.hexagon-wrapper');
                        const tokenInThisHex = hexWrapperElem?.querySelector('.hexagon-content-overlay .unit-map-token');
                        const isOccupiedByOther = tokenInThisHex && tokenInThisHex !== unitTokenBeingDragged;
                        const currentConfig = window.gameNS.config;
                        if (source === 'map-token') { //
                            if (isHighlightedForMovement && !isOccupiedByOther) {
                                polygonElem.setAttribute("fill", currentConfig.hexFillColorMoveValid);
                                polygonElem.style.stroke = currentConfig.hexStrokeColorMoveValid;
                                polygonElem.style.strokeWidth = '2px';
                            } else {
                                polygonElem.setAttribute("fill", currentConfig.hexFillColorInvalid);
                                polygonElem.style.stroke = 'rgba(255,0,0,0.6)';
                                polygonElem.style.strokeWidth = '2px';
                            }
                        } else if (source === 'resource-list') {
                            if (!isOccupiedByOther) {
                                polygonElem.setAttribute("fill", currentConfig.hexFillColorMoveValid);
                                polygonElem.style.stroke = currentConfig.hexStrokeColorMoveValid;
                                polygonElem.style.strokeWidth = '2px';
                            } else {
                                polygonElem.setAttribute("fill", currentConfig.hexFillColorInvalid);
                                polygonElem.style.stroke = 'rgba(255,0,0,0.6)';
                                polygonElem.style.strokeWidth = '2px';
                            }
                        }
                    });
                    svgHex.addEventListener('dragleave', (e) => {
                        const polygonElem = e.currentTarget.querySelector('polygon');
                        if (!polygonElem) return;
                        const currentConfig = window.gameNS.config;
                        const isHighlightedForMovement = window.gameNS.highlightedActionHexes.includes(polygonElem);
                        if (isHighlightedForMovement) {
                            polygonElem.setAttribute('fill', currentConfig.hexFillColorMoveValid);
                            polygonElem.style.stroke = currentConfig.hexStrokeColorMoveValid;
                            polygonElem.style.strokeWidth = '1.5px';
                        } else {
                            polygonElem.setAttribute("fill", currentConfig.hexFillColor);
                            polygonElem.style.stroke = currentConfig.hexStrokeColor || "rgba(0,0,0,0.15)";
                            polygonElem.style.strokeWidth = (currentConfig.hexStrokeWidth || 1).toString() + "px";
                        }
                    });
                    svgHex.addEventListener('drop', (e) => {
                        e.preventDefault();
                        if (window.gameNS.gameState && window.gameNS.gameState.isGameOver) {
                            alert("O jogo já terminou. Nenhuma ação permitida.");
                            const polygonElem = e.currentTarget.querySelector('polygon');
                            if (polygonElem) {
                                const currentConfig = window.gameNS.config;
                                polygonElem.setAttribute("fill", currentConfig.hexFillColor);
                                polygonElem.style.stroke = currentConfig.hexStrokeColor || "rgba(0,0,0,0.15)";
                                polygonElem.style.strokeWidth = (currentConfig.hexStrokeWidth || 1).toString() + "px";
                            }
                            return;
                        }
                        const targetHexSvg = e.currentTarget;
                        const targetHexAlphaNum = targetHexSvg.dataset.alphaNumCoord;
                        if (!targetHexAlphaNum) { console.error("Drop em hexágono sem alphaNumCoord"); return; }
                        const polygonElem = targetHexSvg.querySelector('polygon');
                        if (!polygonElem) { return; }
                        const currentConfig = window.gameNS.config;
                        let dataFromDrag = ""; let sourceTypeFromDrop = "";
                        if (e.dataTransfer) {
                            dataFromDrag = e.dataTransfer.getData('text/plain');
                            sourceTypeFromDrop = e.dataTransfer.getData('source');
                        } else {
                            window.gameNS.clearActionHighlights?.();
                            polygonElem.setAttribute("fill", currentConfig.hexFillColor);
                            polygonElem.style.stroke = currentConfig.hexStrokeColor || "rgba(0,0,0,0.15)";
                            polygonElem.style.strokeWidth = (currentConfig.hexStrokeWidth || 1).toString() + "px";
                            return;
                        }
                        const targetHexWrapperElem = targetHexSvg.closest('.hexagon-wrapper');
                        let targetHexContentOverlayElem = targetHexWrapperElem?.querySelector('.hexagon-content-overlay');
                        if (!targetHexContentOverlayElem && targetHexWrapperElem) {
                            targetHexContentOverlayElem = document.createElement('div');
                            targetHexContentOverlayElem.className = 'hexagon-content-overlay';
                            Object.assign(targetHexContentOverlayElem.style, {
                                position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                pointerEvents: 'none'
                            });
                            targetHexWrapperElem.appendChild(targetHexContentOverlayElem);
                        }
                        if (sourceTypeFromDrop === 'resource-list') {
                            const originalUnitIdKey = dataFromDrag;
                            const unitDataForPlacement = window.gameNS.cardProperties[originalUnitIdKey];
                            if (!unitDataForPlacement) { console.error("Dados da unidade não encontrados para:", originalUnitIdKey); return; }
                            const placingPlayerCountry = window.gameNS.gameState.currentPlayerCountry; //
                            if (unitDataForPlacement["PAÍS"] !== placingPlayerCountry) {
                                alert("Você só pode colocar unidades do seu próprio país."); return;
                            }
                            const maxQuantityFromSquad = parseInt(unitDataForPlacement["ESQUADRAS"]);
                            const currentPlacedCount = window.gameNS.getPlacedUnitCountByType(originalUnitIdKey);
                            const hasLimit = !isNaN(maxQuantityFromSquad) && maxQuantityFromSquad > 0;
                            if (hasLimit && currentPlacedCount >= maxQuantityFromSquad) {
                                alert(`Limite de ${maxQuantityFromSquad} unidades do tipo "${unitDataForPlacement["NOME"]}" atingido.`); return;
                            }
                            if (targetHexContentOverlayElem?.querySelector('.unit-map-token')) {
                                alert("Este hexágono já está ocupado!"); return;
                            }
                            const unitName = unitDataForPlacement["NOME"] || originalUnitIdKey;
                            let unitImageSrc = unitDataForPlacement["IMAGEM"]?.trim() || 'https://placehold.co/38x52/1f2937/9ca3af?text=S/Img';
                            if (unitImageSrc.includes('drive.google.com')) {
                                const fileIdMatch = unitImageSrc.match(/\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
                                unitImageSrc = (fileIdMatch && fileIdMatch[1]) ? `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}` : 'https://placehold.co/38x52/1f2937/9ca3af?text=LnkInv';
                            }
                            const unitToken = document.createElement('div');
                            unitToken.className = 'unit-map-token';
                            unitToken.dataset.originalCardId = originalUnitIdKey;
                            if (!window.gameNS.unitInstanceCounters[originalUnitIdKey]) window.gameNS.unitInstanceCounters[originalUnitIdKey] = 0; //
                            window.gameNS.unitInstanceCounters[originalUnitIdKey]++; //
                            const friendlyInstanceSuffix = window.gameNS.unitInstanceCounters[originalUnitIdKey]; //
                            const uniqueInstanceId = `${originalUnitIdKey.substring(0, 5)}_${Date.now().toString().substring(8)}_${Math.random().toString(36).substring(2, 6)}`;
                            unitToken.dataset.tokenId = uniqueInstanceId;
                            unitToken.title = `${unitName} #${friendlyInstanceSuffix}`;
                            unitToken.setAttribute('draggable', 'true');
                            unitToken.addEventListener('mousedown', (event) => event.stopPropagation() );
                            unitToken.addEventListener('dragstart', (de) => {
                                 if (window.gameNS.gameState && window.gameNS.gameState.isGameOver) {
                                    de.preventDefault();
                                    return;
                                }
                                de.stopPropagation();
                                const draggedToken = de.target.closest('.unit-map-token');
                                if (!draggedToken) { de.preventDefault(); return; }
                                const instanceId = draggedToken.dataset.tokenId;
                                const unitToDragInstanceData = window.gameNS.placedUnits[instanceId]; //
                                if (!unitToDragInstanceData || unitToDragInstanceData.PAÍS !== window.gameNS.gameState.currentPlayerCountry) { //
                                    console.warn(`[UI-LAYOUT DragStart] Tentativa de arrastar unidade (${instanceId}) que não pertence ao jogador atual (${window.gameNS.gameState.currentPlayerName}).`); //
                                    alert("Você só pode mover suas próprias unidades.");
                                    de.preventDefault();
                                    return;
                                }
                                if (typeof window.gameNS.clearUnitInfo === 'function') window.gameNS.clearUnitInfo(); //
                                if (typeof window.gameNS.prepareUnitForAction === 'function') {
                                    window.gameNS.prepareUnitForAction(instanceId, draggedToken);
                                } else { de.preventDefault(); return; }
                                setActiveMapToken(instanceId);
                                if (window.gameNS.activeUnitForAction?.unitInstanceData?.hasMovedThisTurn) { //
                                    alert("Esta unidade já se moveu neste turno."); //
                                    de.preventDefault(); return;
                                }
                                if (window.gameNS.isAiming) { //
                                    alert("Desative o Modo Ofensivo para mover a unidade."); //
                                    de.preventDefault(); return;
                                }
                                de.dataTransfer.setData('text/plain', instanceId);
                                de.dataTransfer.setData('source', 'map-token');
                                draggedToken.classList.add('dragging-map-token');
                                if (typeof window.gameNS.displayMovementRangeVisual === 'function' && //
                                    (!window.gameNS.activeUnitForAction?.unitInstanceData?.hasMovedThisTurn)) { //
                                    window.gameNS.displayMovementRangeVisual(); //
                                }
                            });
                            unitToken.addEventListener('dragend', (de) => {
                                const draggedToken = de.target.closest('.unit-map-token');
                                if (draggedToken) draggedToken.classList.remove('dragging-map-token');
                            });
                            unitToken.addEventListener('click', (ev) => {
                                if (window.gameNS.gameState && window.gameNS.gameState.isGameOver) {
                                    console.log("O jogo terminou. Apenas visualização de unidade permitida.");
                                    // const clickedTokenItself = ev.currentTarget;
                                    // const instanceId = clickedTokenItself.dataset.tokenId;
                                    // populateUnitInfo(instanceId, true);
                                    return;
                                }
                                ev.stopPropagation();
                                const clickedTokenItself = ev.currentTarget;
                                const instanceId = clickedTokenItself.dataset.tokenId;
                                const unitClickedInstanceData = window.gameNS.placedUnits[instanceId]; //
                                if (window.gameNS.activeUnitForAction?.unitIdKey === instanceId && !window.gameNS.isAiming) { //
                                    window.gameNS.clearUnitInfo(); //
                                } else {
                                    if (typeof window.gameNS.clearUnitInfo === 'function') window.gameNS.clearUnitInfo(); //
                                    if (unitClickedInstanceData && unitClickedInstanceData.PAÍS === window.gameNS.gameState.currentPlayerCountry) { //
                                        if (typeof window.gameNS.prepareUnitForAction === 'function') {
                                            window.gameNS.prepareUnitForAction(instanceId, clickedTokenItself);
                                        }
                                    } else if (unitClickedInstanceData) { //
                                        console.log(`[UI-LAYOUT Click] Unidade ${instanceId} (${unitClickedInstanceData.NOME}) não pertence ao jogador atual. Apenas visualização.`); //
                                        window.gameNS.activeUnitForAction = { //
                                            unitIdKey: instanceId, //
                                            unitData: window.gameNS.cardProperties[unitClickedInstanceData.originalUnitIdKey], //
                                            originalUnitIdKey: unitClickedInstanceData.originalUnitIdKey, //
                                            originalHexWrapper: clickedTokenItself.closest('.hexagon-wrapper'), //
                                            unitTokenElement: clickedTokenItself, // Corrected
                                            unitInstanceData: unitClickedInstanceData //
                                        };
                                        setActiveMapToken(instanceId); //
                                    }
                                    populateUnitInfo(instanceId, true);
                                    window.gameNS.switchSidebarView('play');
                                }
                            });
                            const unitImgElement = document.createElement('img');
                            unitImgElement.src = unitImageSrc; unitImgElement.alt = unitName;
                            unitImgElement.onerror = function() { this.src = 'https://placehold.co/38x52/cc0000/ffffff?text=X'; this.alt = 'Erro Img'; };
                            unitToken.appendChild(unitImgElement);
                            if (targetHexContentOverlayElem) {
                                targetHexContentOverlayElem.innerHTML = '';
                                targetHexContentOverlayElem.appendChild(unitToken);
                            } else { console.error("Overlay de conteúdo do hexágono não encontrado para drop."); return; }
                            if (!window.gameNS.placedUnits) window.gameNS.placedUnits = {}; //
                            window.gameNS.placedUnits[uniqueInstanceId] = { //
                                instanceId: uniqueInstanceId, originalUnitIdKey: originalUnitIdKey, currentHex: targetHexAlphaNum, //
                                currentBlindagem: parseInt(unitDataForPlacement["BLINDAGEM"] || 0), //
                                currentMovimento: parseInt(unitDataForPlacement["DESLOCAMENTO"] || 0), //
                                currentAlcance: parseInt(unitDataForPlacement["ALCANCE"] || 0), //
                                PAÍS: unitDataForPlacement["PAÍS"], NOME: unitDataForPlacement["NOME"], //
                                hasMovedThisTurn: false, hasAttackedThisTurn: false, isDamaged: false, //
                                friendlySuffix: friendlyInstanceSuffix //
                            };
                            window.gameNS.applyFilters();
                            populateUnitInfo(uniqueInstanceId, true);
                            window.gameNS.switchSidebarView('play');
                        } else if (sourceTypeFromDrop === 'map-token') { //
                            const draggedInstanceId = dataFromDrag;
                            if (window.gameNS.activeUnitForAction?.unitIdKey === draggedInstanceId) { //
                                if (window.gameNS.activeUnitForAction.unitInstanceData && !window.gameNS.activeUnitForAction.unitInstanceData.hasMovedThisTurn && !window.gameNS.isAiming) { //
                                    if (typeof window.gameNS.attemptMoveOnDrop === 'function') { //
                                        window.gameNS.attemptMoveOnDrop(targetHexWrapperElem, window.gameNS.activeUnitForAction); //
                                    } else { console.error("attemptMoveOnDrop não encontrada"); window.gameNS.clearActionHighlights?.(); } //
                                } else {
                                    if (window.gameNS.isAiming) alert("Desative o Modo Ofensivo para mover."); //
                                    else if (window.gameNS.activeUnitForAction.unitInstanceData.hasMovedThisTurn) alert("Esta unidade já moveu."); //
                                    else alert("Movimento inválido."); //
                                    window.gameNS.clearActionHighlights?.(); //
                                }
                            } else {
                                console.warn("Drop de token que não é a unidade ativa.");
                                window.gameNS.clearActionHighlights?.();
                            }
                        }
                        const isStillHighlightedForMovement = window.gameNS.highlightedActionHexes.includes(polygonElem);
                        if (!isStillHighlightedForMovement) {
                            polygonElem.setAttribute("fill", currentConfig.hexFillColor);
                            polygonElem.style.stroke = currentConfig.hexStrokeColor || "rgba(0,0,0,0.15)";
                            polygonElem.style.strokeWidth = (currentConfig.hexStrokeWidth || 1).toString() + "px";
                        }
                    });

                    hexWrapper.appendChild(svgHex);
                    rowDiv.appendChild(hexWrapper);
                }
                gridContainer.appendChild(rowDiv);
            }
            const resetViewButton = document.getElementById('reset-view-button');
            if (resetViewButton && typeof resetViewButton.click === 'function') {
                const attemptResetView = (maxAttempts = 10, delay = 100) => {
                    let attempts = 0;
                    function tryReset() {
                        if (gridContainer.offsetWidth > 0 && gridContainer.offsetHeight > 0 && gameBoard.offsetParent !== null) {
                            resetViewButton.click();
                        } else if (attempts < maxAttempts) {
                            attempts++; setTimeout(tryReset, delay);
                        }
                    }
                    setTimeout(tryReset, delay);
                };
                attemptResetView();
            }
        };

        if (typeof window.gameNS.initializeMapControls === 'function') {
            window.gameNS.initializeMapControls();
        }
        initializeSettingsControls();

        const filterForcaSelect = document.getElementById('filter-forca-select');
        const filterCategoriaSelect = document.getElementById('filter-categoria-select');
        if (filterForcaSelect) {
            filterForcaSelect.addEventListener('change', function() {
                window.gameNS.updateCategoriaFilter(this.value);
                window.gameNS.applyFilters();
            });
        }
        if (filterCategoriaSelect) {
            filterCategoriaSelect.addEventListener('change', window.gameNS.applyFilters);
        }

        document.addEventListener('click', (e) => {
            const target = e.target;
            const isInteractiveElement = target.closest('.hexagon-svg') ||
                                        target.closest('.unit-map-token') ||
                                        target.closest('#info-popup') ||
                                        target.closest('.resource-card') ||
                                        target.closest('#icon-action-bar .icon-bar-button') ||
                                        target.closest('#selected-asset-info button') ||
                                        target.closest('.action-switch-container') ||
                                        target.closest('#sidebar-toggle-button') ||
                                        target.closest('.filter-controls select') ||
                                        target.closest('#zoom-controls button') ||
                                        target.closest('#sidebar-btn-end-turn') ||
                                        target.closest('.attack-target-icon') || //
                                        target.closest('#settings-section') ||
                                        target.closest('#status-turn-section');

            const isGameBoardItself = target.id === 'game-board' || target.id === 'grid-container';

            if (!isInteractiveElement || isGameBoardItself) {
                if (window.gameNS.isAiming && typeof window.gameNS.cancelAimingMode === 'function') { //
                    window.gameNS.cancelAimingMode(); //
                    if (window.gameNS.activeUnitForAction?.unitIdKey) { //
                        populateUnitInfo(window.gameNS.activeUnitForAction.unitIdKey, true); //
                    }
                } else if (window.gameNS.activeUnitForAction && !target.closest('#game-sidebar')) { //
                    window.gameNS.clearUnitInfo(); //
                } else if (!window.gameNS.activeUnitForAction) { //
                    if (window.gameNS?.hideHexInfo) window.gameNS.hideHexInfo(); //
                    if (window.gameNS.clearActionHighlights) window.gameNS.clearActionHighlights();
                }

                if (!target.closest('#info-popup') && !target.closest('.hexagon-svg')) { //
                    if (window.gameNS?.hideHexInfo) window.gameNS.hideHexInfo(); //
                }
            }
        });

        try {
            let gameWasEffectivelyLoaded = false;
            let newGameTargetSlot = null;

            const selectedNewGameSlotString = localStorage.getItem('selectedNewGameSlot'); //
            if (selectedNewGameSlotString !== null) { //
                newGameTargetSlot = parseInt(selectedNewGameSlotString); //
                console.log(`[UI-LAYOUT DOMContentLoaded] Novo jogo será associado ao Slot: ${newGameTargetSlot + 1}`); //
                localStorage.removeItem('selectedNewGameSlot'); //
            }

            const loadedGameFromSlotString = localStorage.getItem('loadedGameStateFromSlot'); //
            if (loadedGameFromSlotString) { //
                console.log("[UI-LAYOUT DOMContentLoaded] Encontrado 'loadedGameStateFromSlot'. Restaurando..."); //
                try {
                    const loadedFullState = JSON.parse(loadedGameFromSlotString); //
                    if (loadedFullState && loadedFullState.mapFile) { //
                        window.gameNS.gameState = loadedFullState; //
                        window.gameNS.currentGameInfo = { ...window.gameNS.gameState }; //
                        window.gameNS.placedUnits = window.gameNS.gameState.placedUnits || {}; //
                        window.gameNS.unitInstanceCounters = window.gameNS.gameState.unitInstanceCounters || {}; //
                        window.gameNS.loadedState.activeUnitInstanceId = window.gameNS.gameState.activeUnitInstanceId || null; //
                        window.gameNS.gameState.gameModeBeenSetThisSession = true; //

                        console.log("%c[UI-LAYOUT DOMContentLoaded] Estado do jogo restaurado de 'loadedGameStateFromSlot'!", "color: lightgreen;"); //
                        gameWasEffectivelyLoaded = true;
                    } else {
                         console.error("[UI-LAYOUT DOMContentLoaded] Estrutura de 'loadedGameStateFromSlot' inesperada ou incompleta."); //
                    }
                    localStorage.removeItem('loadedGameStateFromSlot'); //
                } catch (error) {
                    console.error("[UI-LAYOUT DOMContentLoaded] Erro ao parsear 'loadedGameStateFromSlot':", error); //
                    localStorage.removeItem('loadedGameStateFromSlot'); //
                }
            }

            if (!gameWasEffectivelyLoaded && newGameTargetSlot === null) { //
                gameWasEffectivelyLoaded = window.gameNS.loadGameStateFromLocalStorage();
            }

            await loadUnitData();

            if (!gameWasEffectivelyLoaded && typeof loadSetup !== 'undefined' && loadSetup && loadSetup.gameMode) { //
                console.log("[UI-LAYOUT DOMContentLoaded] Nenhum save carregado. Usando 'loadSetup' do menu para NOVO JOGO:", loadSetup); //
                if (loadSetup.gameMode === 'Campanha' && typeof window.gameNS.initializeCampaignGame === 'function') { //
                    window.gameNS.initializeCampaignGame(loadSetup); //
                } else if (loadSetup.gameMode === 'Versus Local' && typeof window.gameNS.initializeMultiplayerLocalGame === 'function') { //
                    window.gameNS.initializeMultiplayerLocalGame(loadSetup); //
                }
                if (newGameTargetSlot !== null && window.gameNS.gameState) { //
                    window.gameNS.gameState.currentSaveSlot = newGameTargetSlot; //
                    console.log(`[UI-LAYOUT DOMContentLoaded] Novo jogo iniciado. Slot ativo da partida definido para: ${newGameTargetSlot + 1}`); //
                }
            } else if (gameWasEffectivelyLoaded) { //
                console.log("[UI-LAYOUT DOMContentLoaded] Jogo carregado de um slot. 'loadSetup' do menu ignorado."); //
            } else if (newGameTargetSlot !== null && typeof loadSetup !== 'undefined' && loadSetup && loadSetup.gameMode) { //
                console.log("[UI-LAYOUT DOMContentLoaded] Novo jogo com slot selecionado, aguardando processamento do loadSetup."); //
                 if (loadSetup.gameMode === 'Campanha' && typeof window.gameNS.initializeCampaignGame === 'function') { //
                    window.gameNS.initializeCampaignGame(loadSetup); //
                } else if (loadSetup.gameMode === 'Versus Local' && typeof window.gameNS.initializeMultiplayerLocalGame === 'function') { //
                    window.gameNS.initializeMultiplayerLocalGame(loadSetup); //
                }
                if (window.gameNS.gameState) { // Após a inicialização //
                    window.gameNS.gameState.currentSaveSlot = newGameTargetSlot; //
                     console.log(`[UI-LAYOUT DOMContentLoaded] Novo jogo iniciado (pós-loadSetup). Slot ativo da partida definido para: ${newGameTargetSlot + 1}`); //
                }
            } else {
                 console.warn("[UI-LAYOUT DOMContentLoaded] Nenhuma informação de save ou setup de novo jogo encontrada. O estado do jogo pode estar indefinido.");
            }

            window.gameNS.loadAndDisplayGameInfo();

            if (typeof window.createHexGrid === 'function') {
                window.createHexGrid();
            }

            if (gameWasEffectivelyLoaded) { //
                if (typeof window.gameNS.rebuildPlacedUnitsOnMap === 'function') {
                    window.gameNS.rebuildPlacedUnitsOnMap();
                }
                if (window.gameNS.loadedState.activeUnitInstanceId) { //
                    const activeId = window.gameNS.loadedState.activeUnitInstanceId; //
                    const tokenElement = document.querySelector(`.unit-map-token[data-token-id="${activeId}"]`);
                    const activeUnitInstance = window.gameNS.placedUnits[activeId]; //
                    if (tokenElement && activeUnitInstance) { //
                        console.log(`[UI-LAYOUT DOMContentLoaded] Restaurando seleção para unidade: ${activeId}`);
                        if (activeUnitInstance.PAÍS === window.gameNS.gameState.currentPlayerCountry) { //
                           if (typeof window.gameNS.prepareUnitForAction === 'function') {
                               window.gameNS.prepareUnitForAction(activeId, tokenElement);
                           }
                       } else {
                            window.gameNS.activeUnitForAction = { //
                               unitIdKey: activeId, //
                               unitData: window.gameNS.cardProperties[activeUnitInstance.originalUnitIdKey], //
                               originalUnitIdKey: activeUnitInstance.originalUnitIdKey, //
                               originalHexWrapper: tokenElement.closest('.hexagon-wrapper'), //
                               unitTokenElement: tokenElement, //
                               unitInstanceData: activeUnitInstance //
                           };
                           setActiveMapToken(activeId); //
                       }
                       populateUnitInfo(activeId, true);
                   } else {
                       console.warn(`[UI-LAYOUT DOMContentLoaded] Unidade ativa salva (${activeId}) não encontrada no mapa ou em placedUnits ao tentar restaurar seleção.`);
                   }
                    window.gameNS.loadedState.activeUnitInstanceId = null; //
                }
            }

            if (window.gameNS.gameState && window.gameNS.gameState.currentPlayerCountryForResourceFilter) { //
                window.gameNS.populateForcaFilter(window.gameNS.gameState.currentPlayerCountryForResourceFilter); //
            } else {
                 console.error("[UI-LAYOUT DOMContentLoaded] gameState ou currentPlayerCountryForResourceFilter não definido antes de chamar populateForcaFilter. Usando N/A.");
                 window.gameNS.populateForcaFilter('N/A');
            }

            const filterForcaSelectElement = document.getElementById('filter-forca-select');
            const initialForcaValue = filterForcaSelectElement ? filterForcaSelectElement.value : "todos";
            window.gameNS.updateCategoriaFilter(initialForcaValue);
            window.gameNS.applyFilters();
            window.gameNS.switchSidebarView('play');
            if(typeof updateSidebarToggleButton === "function") updateSidebarToggleButton();
            loadSettings();
            console.log("[UI-LAYOUT DOMContentLoaded] Processos de inicialização concluídos.");

            const sidebarBtnEndTurn = document.getElementById('sidebar-btn-end-turn');
            if (sidebarBtnEndTurn) {
                sidebarBtnEndTurn.addEventListener('click', () => {
                    if (window.gameNS && typeof window.gameNS.endTurn === 'function') { //
                        try { window.gameNS.endTurn(); } //
                        catch (e) { console.error("[UI-LAYOUT] Erro CRÍTICO ao chamar window.gameNS.endTurn (sidebar):", e); alert("Erro crítico: " + e.message); }
                    } else {
                        console.error("[UI-LAYOUT] ERRO: A função window.gameNS.endTurn não é uma função válida (sidebar).");
                        alert("Erro: Função de finalizar turno indisponível (sidebar).");
                    }
                });
            } else {
                console.warn("[UI-LAYOUT DOMContentLoaded] Botão 'sidebar-btn-end-turn' não encontrado.")
            }
        } catch (err) {
            console.error("[UI-LAYOUT DOMContentLoaded] Erro catastrófico na inicialização:", err);
            alert("Falha grave ao iniciar. Verifique o console para mais detalhes.");
        }
    });

    window.gameNS.prepareUnitForAction = window.gameNS.prepareUnitForAction || function(instanceId, unitTokenElement) {
        const originalUnitKey = unitTokenElement?.dataset.originalCardId;
        const unitBaseData = window.gameNS.cardProperties[originalUnitKey];
        const unitInstanceActualData = window.gameNS.placedUnits ? window.gameNS.placedUnits[instanceId] : null; //

        if (!unitBaseData || !unitInstanceActualData || !unitTokenElement || !unitTokenElement.closest('.hexagon-wrapper')) {
            console.warn("prepareUnitForAction: Dados inválidos ou unidade não encontrada.", instanceId, unitBaseData, unitInstanceActualData);
            window.gameNS.activeUnitForAction = null;
            return;
        }

        let activeUnitDisplayData = JSON.parse(JSON.stringify(unitBaseData));

        window.gameNS.activeUnitForAction = {
            unitIdKey: instanceId,
            unitData: activeUnitDisplayData,
            originalUnitIdKey: originalUnitKey,
            originalHexWrapper: unitTokenElement.closest('.hexagon-wrapper'),
            unitTokenElement: unitTokenElement,
            unitInstanceData: unitInstanceActualData
        };
        console.log(`[UI-LAYOUT prepareUnitForAction] Unidade ${instanceId} preparada/selecionada. Pertence a: ${unitInstanceActualData.PAÍS}. Jogador atual: ${window.gameNS.gameState.currentPlayerCountry}`); //
    };

    // Função para popular o popup de save in-game
    function populateInGameSaveSlots() {
        const container = document.getElementById('ingame-save-slot-selection-container');
        if (!container) {
            console.error("Container para slots de save in-game não encontrado.");
            return;
        }
        container.innerHTML = ''; // Limpa slots antigos
        const savedGames = JSON.parse(localStorage.getItem(window.gameNS.SAVE_SLOTS_KEY /* Acessa SAVE_SLOTS_KEY do game-logic se estiver lá, senão define localmente */ )) || Array(window.gameNS.MAX_SAVE_SLOTS || 5).fill(null); //

        for (let i = 0; i < (window.gameNS.MAX_SAVE_SLOTS || 5); i++) { //
            const slotData = savedGames[i];
            const slotButton = document.createElement('button');
            slotButton.classList.add('popup-button', 'w-full', 'mb-2', 'text-sm'); // Reutiliza classes de botão do popup
            let slotText = `SALVAR NO SLOT ${i + 1}: `;

            if (slotData && slotData.mapFile) { // Verifica se o slot está ocupado (gameState válido) //
                slotButton.classList.add('popup-button-danger'); // Vermelho para ocupado/sobrescrever //
                slotText += `Ocupado - ${slotData.gameMode || 'Jogo'} (Turno ${slotData.currentTurn || 'N/A'})`; //
                slotButton.title = `Sobrescrever jogo salvo no Slot ${i + 1}?`;
            } else {
                slotButton.classList.add('popup-button-primary'); // Verde para vazio //
                slotText += 'Vazio';
                slotButton.title = `Salvar jogo atual no Slot ${i + 1}`;
            }
            slotButton.textContent = slotText;
            slotButton.dataset.slotIndex = i;

            slotButton.onclick = () => {
                const performSave = () => {
                    if (typeof window.gameNS.saveGameToSlot === 'function') { //
                        if (window.gameNS.saveGameToSlot(i)) { // Passa o índice do slot para salvar //
                            // O alerta é dado dentro de saveGameToSlot para saves manuais
                            document.getElementById('popup-ingame-save-slots').classList.add('popup-hidden');
                            // Opcional: Atualizar a lista de slots no popup de carregar no menu, se estiver aberto
                            // (mas geralmente o menu não estará aberto ao mesmo tempo)
                        } else {
                            alert(`Falha ao salvar no Slot ${i + 1}. Verifique o console.`);
                        }
                    } else {
                        console.error("Função window.gameNS.saveGameToSlot não encontrada!");
                    }
                };

                if (slotData && slotData.mapFile) { //
                    if (confirm(`Slot ${i + 1} já contém um jogo salvo. Deseja sobrescrevê-lo?`)) {
                        performSave();
                    }
                } else {
                    performSave(); // Slot vazio, salva diretamente
                }
            };
            container.appendChild(slotButton);
        }

    };

    
