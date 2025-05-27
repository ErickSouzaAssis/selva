// movement-logic.js

window.gameNS = window.gameNS || {};

// Mapeamento de CATEGORIA (do csvjson.json) para TipoMovimento genérico
// É crucial que as chaves aqui correspondam EXATAMENTE às strings em seus dados JSON.
window.gameNS.unitMovementTypesMap = {
    // Tropas
    "Infantaria": "Tropa", "Comandos VZ": "Tropa", "Paraquedistas": "Tropa",
    "Infantaria Leve": "Tropa", "Comandos BR": "Tropa", "PQD": "Tropa",
    "Míssil Antiaéreo Portátil": "Tropa", // Geralmente movido por infantaria

    // Veículos Leves (alta mobilidade em terreno bom, penalidade em ruim)
    "Veículo de Reconhecimento": "VeiculoLeve",
    "Viatura Blindada Transporte Pessoal (Leve s/Armamento)": "VeiculoLeve", // Ex: Cascavel

    // Veículos Pesados (boa mobilidade em estradas, mais penalizados em terreno ruim)
    "Tanque de Batalha": "VeiculoPesado",
    "VCI": "VeiculoPesado", // Veículo de Combate de Infantaria (ex: BMP-2, AMX-13 VCI)
    "Viatura Blindada de Combate": "VeiculoPesado", // Ex: Guarani
    "Artilharia Autopropulsada": "VeiculoPesado",
    "Lançador Múltiplo de Foguetes": "VeiculoPesado",
    "Artilharia antiaerea": "VeiculoPesado", // Sistemas móveis (ex: SA-8, SA-13)
    "Sistema de Defesa Antiaérea": "VeiculoPesado", // Ex: Gepard

    // Artilharia Rebocada (movimento muito lento, precisa de veículo ou muito tempo)
    "Artilharia Rebocada": "ArtilhariaRebocada",
    "Artilharia de Campanha": "ArtilhariaRebocada",
    "Canhão Antiaéreo": "ArtilhariaRebocada", // Ex: ZU-23-2 (se rebocado)

    // Unidades Aéreas (ignoram a maioria dos custos de terreno para movimento, custo 1 por hex)
    "Avião caça": "Aereo",
    "Avião de Ataque leve": "Aereo",
    "Avião de Transporte tático pesado": "Aereo",
    "Avião de Transporte tático médio": "Aereo",
    "Helicópteros de transporte médio": "Aereo",
    "Helicópteros de ataque": "Aereo",
    "Helicóptero de Ataque": "Aereo", // Duplicata comum em dados
    "Helicóptero de Transporte": "Aereo", // Duplicata comum
    "Helicóptero Transporte": "Aereo", // Duplicata comum
    "Helicóptero Ataque": "Aereo", // Duplicata comum
    "Reconhecimento": "Aereo", // Aeronaves de reconhecimento (ex: C-26, R-99, E-99)
    "Patrulha Marítima": "Aereo", // Ex: P-3 Orion

    // Unidades com regras especiais de movimento ou estáticas
    "Sistema de radar": "EstaticoOuVeiculoRadar" // Pode ser estático ou montado em veículo.
                                                // Se for móvel, pode ser 'VeiculoLeve' ou 'VeiculoPesado'
                                                // Se for estático, o movimento base deve ser 0.
    // Adicione outros tipos conforme necessário.
};

/**
 * Obtém o tipo de movimento genérico para uma unidade com base em sua categoria.
 * @param {object} unitData - Os dados base da unidade (de cardProperties).
 * @returns {string} O tipo de movimento genérico (ex: "Tropa", "VeiculoPesado", "Aereo").
 */
function getUnitMovementType(unitData) {
    if (!unitData || !unitData.CATEGORIA) {
        console.warn("[MOVEMENT-LOGIC getUnitMovementType] Dados da unidade ou categoria ausentes. Retornando 'Desconhecido'.");
        return "Desconhecido";
    }
    const type = window.gameNS.unitMovementTypesMap[unitData.CATEGORIA];
    if (!type) {
        console.warn(`[MOVEMENT-LOGIC getUnitMovementType] Categoria '${unitData.CATEGORIA}' não mapeada para um tipo de movimento. Usando 'TerrestreGenerico' como fallback. Verifique unitMovementTypesMap.`);
        return "TerrestreGenerico"; // Tipo padrão para categorias não mapeadas
    }
    return type;
}

/**
 * Calcula quais hexágonos são alcançáveis por uma unidade.
 * @param {HTMLElement} startHexWrapper - O elemento wrapper do hexágono de partida.
 * @param {number} totalMovementPoints - Pontos de movimento totais da unidade.
 * @param {string} unitMovementGenType - O tipo de movimento genérico da unidade (ex: "Tropa", "VeiculoPesado", "Aereo").
 * @returns {Set<string>} Um Set de coordenadas alfa-numéricas dos hexágonos alcançáveis (excluindo o de partida).
 */
window.gameNS.getReachableHexes = function(startHexWrapper, totalMovementPoints, unitMovementGenType) {
    const reachableHexCoords = new Set();
    if (!startHexWrapper || isNaN(totalMovementPoints) || totalMovementPoints === null || !unitMovementGenType) {
        console.warn("[MOVEMENT-LOGIC getReachableHexes] Parâmetros inválidos.", {startHexWrapper, totalMovementPoints, unitMovementGenType});
        return reachableHexCoords;
    }

    if (unitMovementGenType !== "Aereo" && totalMovementPoints <= 0) return reachableHexCoords;
    if (unitMovementGenType === "Aereo" && totalMovementPoints < 1) return reachableHexCoords; // Aéreo precisa de pelo menos 1 para mover 1 hex.

    let queue = [{ hexWrapper: startHexWrapper, remainingMove: totalMovementPoints }];
    let visitedWithRemaining = new Map(); // Map<alphaNumCoord, remainingMovePoints>

    const startHexSvg = startHexWrapper.querySelector('.hexagon-svg');
    if (!startHexSvg) {
         console.error("[MOVEMENT-LOGIC getReachableHexes] SVG do hexágono de partida não encontrado.");
        return reachableHexCoords;
    }
    const startHexCoord = startHexSvg.dataset.alphaNumCoord;
    visitedWithRemaining.set(startHexCoord, totalMovementPoints);

    while (queue.length > 0) {
        let { hexWrapper: currentHexWrapper, remainingMove: currentRemainingMove } = queue.shift();
        const currentHexSvg = currentHexWrapper.querySelector('.hexagon-svg');
        if (!currentHexSvg) continue;
        // const currentHexCoord = currentHexSvg.dataset.alphaNumCoord; // Não usado diretamente aqui, mas bom para debug

        // Condição de parada para exploração a partir deste hex
        if (unitMovementGenType !== "Aereo" && currentRemainingMove <= 0) continue;
        if (unitMovementGenType === "Aereo" && currentRemainingMove < 1) continue;

        const neighborAlphaNumCoords = window.gameNS.getNeighborHexCoords(currentHexSvg.dataset.alphaNumCoord);

        for (const neighborAlphaNumCoord of neighborAlphaNumCoords) {
            const neighborHexSvg = window.gameNS.utils.getHexagonSvgByCoord(neighborAlphaNumCoord);
            const neighborHexWrapper = neighborHexSvg?.closest('.hexagon-wrapper');

            if (neighborHexWrapper && neighborAlphaNumCoord) {
                let costToEnter = 1; // Custo base (para aéreos ou terreno padrão)
                const terrainInfo = window.gameNS.terrainData?.[neighborAlphaNumCoord];

                if (unitMovementGenType !== "Aereo") { // Custo de terreno para unidades não-aéreas
                    if (terrainInfo) {
                        // Verifica se o tipo de unidade é PERMITIDO no terreno
                        if (terrainInfo.TiposUnidadePermitidos && typeof terrainInfo.TiposUnidadePermitidos === 'string') {
                            const allowedTypes = terrainInfo.TiposUnidadePermitidos.split(',').map(t => t.trim());
                            if (!allowedTypes.includes(unitMovementGenType) && !allowedTypes.includes("Terrestre") && !allowedTypes.includes("Todos")) {
                                costToEnter = Infinity; // Movimento impossível se tipo não permitido
                            }
                        }
                        // Se o movimento não é impossível, calcula o custo do terreno
                        if (costToEnter !== Infinity) {
                            costToEnter = (typeof terrainInfo.CustoMovHex === 'number' && terrainInfo.CustoMovHex >= 0) ? terrainInfo.CustoMovHex : 1;
                            if (costToEnter !== Infinity) costToEnter = Math.max(1, costToEnter); // Custo mínimo 1
                        }
                    }
                }
                // Unidades aéreas geralmente têm custo 1 por hex, ignorando terreno para *movimento*.
                // A aterrissagem seria uma verificação separada (ex: só pode pousar em aeroporto).
                // A lógica de TiposUnidadePermitidos pode cobrir isso se "Aereo" estiver listado.

                // Verifica se o hexágono vizinho está OCUPADO por OUTRA unidade
                const existingTokenInNeighbor = neighborHexWrapper.querySelector('.unit-map-token');
                if (existingTokenInNeighbor) {
                     // Não pode mover para um hex ocupado por outra unidade.
                     // A unidade ativa (que está sendo movida) não estará no 'neighborHexWrapper' durante este cálculo.
                     costToEnter = Infinity;
                }

                const newRemainingMove = currentRemainingMove - costToEnter;

                if (costToEnter !== Infinity && newRemainingMove >= -0.001) { // -0.001 para tolerância de float
                    if (!visitedWithRemaining.has(neighborAlphaNumCoord) || newRemainingMove > visitedWithRemaining.get(neighborAlphaNumCoord)) {
                        visitedWithRemaining.set(neighborAlphaNumCoord, newRemainingMove);
                        queue.push({ hexWrapper: neighborHexWrapper, remainingMove: newRemainingMove });
                        reachableHexCoords.add(neighborAlphaNumCoord); // Adiciona à lista de alcançáveis
                    }
                }
            }
        }
    }
    // console.log(`[MOVEMENT-LOGIC getReachableHexes] Alcançáveis a partir de ${startHexCoord} com ${totalMovementPoints}pts para tipo ${unitMovementGenType}:`, Array.from(reachableHexCoords));
    return reachableHexCoords;
};

/**
 * Exibe os hexágonos de movimento alcançável e o círculo de alcance.
 */
window.gameNS.displayMovementRangeVisual = function() {
    // console.log("[MOVEMENT-LOGIC displayMovementRangeVisual] Chamada.");
    if (!window.gameNS.activeUnitForAction?.originalHexWrapper || !window.gameNS.activeUnitForAction?.unitInstanceData) {
        console.warn("[MOVEMENT-LOGIC displayMovementRangeVisual] Contexto ativo, originalHexWrapper ou unitInstanceData ausente.");
        window.gameNS.clearActionHighlights?.();
        window.gameNS.clearUnitInfo?.();
        return;
    }

    const { unitData, originalHexWrapper, unitInstanceData, unitIdKey } = window.gameNS.activeUnitForAction;

    if (unitInstanceData.hasMovedThisTurn) {
        // console.log(`[MOVEMENT-LOGIC displayMovementRangeVisual] Unidade ${unitIdKey} já moveu.`);
        alert("Esta unidade já se moveu neste turno.");
        window.gameNS.clearActionHighlights?.();
        window.gameNS.populateUnitInfo?.(unitIdKey, true);
        return;
    }

    const movementPoints = parseInt(unitInstanceData.currentMovimento);
    const unitType = getUnitMovementType(unitData);

    if (isNaN(movementPoints) || (unitType !== "Aereo" && movementPoints <= 0) || (unitType === "Aereo" && movementPoints < 1) ) {
        // console.log(`[MOVEMENT-LOGIC displayMovementRangeVisual] Unidade ${unitIdKey} não pode mover (Movimento: ${movementPoints}, Tipo: ${unitType}).`);
         alert(`Unidade ${unitData.NOME || 'selecionada'} não tem pontos de movimento suficientes.`);
        window.gameNS.clearActionHighlights?.();
        window.gameNS.populateUnitInfo?.(unitIdKey, true);
        return;
    }

    window.gameNS.clearActionHighlights?.(); // Limpa destaques anteriores (importante se alternando entre mira e movimento)

    const reachableHexCoords = window.gameNS.getReachableHexes(originalHexWrapper, movementPoints, unitType);

     if (reachableHexCoords.size === 0) {
         // console.log(`[MOVEMENT-LOGIC displayMovementRangeVisual] Nenhum hexágono alcançável para ${unitIdKey}.`);
         if (typeof window.showRangeIndicator === 'function') {
             window.showRangeIndicator(originalHexWrapper, movementPoints, 'movimento');
         }
          alert(`Unidade ${unitData.NOME || 'selecionada'} não pode se mover para nenhum hexágono adjacente.`);
         return;
     }

    reachableHexCoords.forEach(coord => {
        const hexSvg = window.gameNS.utils.getHexagonSvgByCoord(coord);
        if (hexSvg) {
            const hexPolygon = hexSvg.querySelector('polygon');
            // O hex de origem não deve ser destacado como destino de movimento.
            // getReachableHexes já exclui a origem, então todos aqui são destinos válidos.
            if (hexPolygon) {
                 hexPolygon.setAttribute('fill', window.gameNS.config.hexFillColorMoveValid);
                 hexPolygon.style.stroke = window.gameNS.config.hexStrokeColorMoveValid;
                 hexPolygon.style.strokeWidth = '1.5px';
                 window.gameNS.highlightedActionHexes.push(hexPolygon);
            }
        }
    });

    if (typeof window.showRangeIndicator === 'function') {
        window.showRangeIndicator(originalHexWrapper, movementPoints, 'movimento');
    }
    // console.log("[MOVEMENT-LOGIC displayMovementRangeVisual] Visuais de movimento mostrados.");
};

/**
 * Tenta mover a unidade ativa para o hexágono de destino quando o token é solto.
 * @param {HTMLElement} targetHexWrapper - O elemento wrapper do hexágono onde o token foi solto.
 * @param {object} activeUnitContext - O contexto da unidade ativa (window.gameNS.activeUnitForAction).
 */
window.gameNS.attemptMoveOnDrop = function(targetHexWrapper, activeUnitContext) {
    // console.log("[MOVEMENT attemptMoveOnDrop] Chamada.");
    if (!activeUnitContext?.unitTokenElement || !activeUnitContext.unitIdKey || !activeUnitContext.unitData ||
        !activeUnitContext.originalHexWrapper || !activeUnitContext.unitInstanceData || !targetHexWrapper) {
        console.error("[MOVEMENT attemptMoveOnDrop] ERRO: Contexto inválido.", activeUnitContext);
        window.gameNS.clearActionHighlights?.();
        window.gameNS.clearUnitInfo?.();
        return;
    }

    const { unitIdKey, unitData, originalHexWrapper, unitTokenElement, unitInstanceData } = activeUnitContext;
    const targetHexSvg = targetHexWrapper.querySelector('.hexagon-svg');
    const targetHexCoord = targetHexSvg?.dataset.alphaNumCoord;

    if (!targetHexCoord) {
         console.error("[MOVEMENT attemptMoveOnDrop] Hexágono de destino sem coordenada.");
         window.gameNS.clearActionHighlights?.();
         if (originalHexWrapper && unitTokenElement && originalHexWrapper !== targetHexWrapper) {
            const originalOverlay = originalHexWrapper.querySelector('.hexagon-content-overlay');
            if (originalOverlay && !originalOverlay.contains(unitTokenElement)) {
                 if(unitTokenElement.parentNode) unitTokenElement.parentNode.removeChild(unitTokenElement);
                 originalOverlay.appendChild(unitTokenElement);
            }
         }
         window.gameNS.populateUnitInfo?.(unitIdKey, true);
         return;
    }

    if (unitInstanceData.hasMovedThisTurn) {
        console.warn(`[MOVEMENT attemptMoveOnDrop] Unidade ${unitIdKey} já moveu.`);
        alert("Esta unidade já se moveu neste turno.");
        window.gameNS.clearActionHighlights?.();
         if (originalHexWrapper && unitTokenElement && originalHexWrapper !== targetHexWrapper) {
            const originalOverlay = originalHexWrapper.querySelector('.hexagon-content-overlay');
            if (originalOverlay && !originalOverlay.contains(unitTokenElement)) {
                 if(unitTokenElement.parentNode) unitTokenElement.parentNode.removeChild(unitTokenElement);
                 originalOverlay.appendChild(unitTokenElement);
            }
         }
         window.gameNS.populateUnitInfo?.(unitIdKey, true);
        return;
    }

    if (targetHexWrapper === originalHexWrapper) {
        // console.log(`[MOVEMENT attemptMoveOnDrop] Drop no hexágono de origem (${targetHexCoord}). Movimento cancelado.`);
        window.gameNS.clearActionHighlights?.();
        window.gameNS.populateUnitInfo?.(unitIdKey, true);
        return;
    }

    const tokenInTargetHex = targetHexWrapper.querySelector('.unit-map-token');
    if (tokenInTargetHex && tokenInTargetHex !== unitTokenElement) {
        console.warn(`[MOVEMENT attemptMoveOnDrop] Tentativa de mover para hex ocupado (${targetHexCoord}).`);
        alert("Movimento inválido: Hexágono de destino ocupado!");
        window.gameNS.clearActionHighlights?.();
        if (originalHexWrapper && unitTokenElement && originalHexWrapper !== targetHexWrapper) {
            const originalOverlay = originalHexWrapper.querySelector('.hexagon-content-overlay');
            if (originalOverlay && !originalOverlay.contains(unitTokenElement)) {
                 if(unitTokenElement.parentNode) unitTokenElement.parentNode.removeChild(unitTokenElement);
                 originalOverlay.appendChild(unitTokenElement);
            }
        }
         window.gameNS.populateUnitInfo?.(unitIdKey, true);
        return;
    }

    const movementPoints = parseInt(unitInstanceData.currentMovimento);
    const unitType = getUnitMovementType(unitData);
    const reachableHexes = window.gameNS.getReachableHexes(originalHexWrapper, movementPoints, unitType);

    if (reachableHexes.has(targetHexCoord)) {
        console.log(`%c[MOVEMENT attemptMoveOnDrop] Movimento válido: Unidade ${unitIdKey} move para ${targetHexCoord}.`, 'color: yellow;');

        originalHexWrapper.querySelector('.hexagon-content-overlay')?.removeChild(unitTokenElement);
        let targetOverlay = targetHexWrapper.querySelector('.hexagon-content-overlay');
        if (!targetOverlay) {
             targetOverlay = document.createElement('div');
             targetOverlay.className = 'hexagon-content-overlay';
             Object.assign(targetOverlay.style, {
                position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none'
             });
             targetHexWrapper.appendChild(targetOverlay);
        }
         targetOverlay.innerHTML = '';
        targetOverlay.appendChild(unitTokenElement);

        if (window.gameNS.placedUnits?.[unitIdKey]) {
            window.gameNS.placedUnits[unitIdKey].hasMovedThisTurn = true;
            window.gameNS.placedUnits[unitIdKey].currentHex = targetHexCoord;
        }

        if (activeUnitContext.unitIdKey === unitIdKey) {
             activeUnitContext.hasMovedThisTurn = true;
             activeUnitContext.originalHexWrapper = targetHexWrapper;
             activeUnitContext.unitInstanceData.hasMovedThisTurn = true;
             activeUnitContext.unitInstanceData.currentHex = targetHexCoord;
        }

        window.gameNS.clearActionHighlights?.();
        window.gameNS.populateUnitInfo?.(unitIdKey, true); // Atualiza UI para refletir que moveu
    } else {
        console.warn(`[MOVEMENT attemptMoveOnDrop] Movimento inválido: Hexágono ${targetHexCoord} fora de alcance ou terreno proibido.`);
        alert("Movimento inválido: Destino fora de alcance ou terreno proibido!");
        window.gameNS.clearActionHighlights?.();
         if (originalHexWrapper && unitTokenElement && originalHexWrapper !== targetHexWrapper) {
            const targetOverlay = targetHexWrapper.querySelector('.hexagon-content-overlay');
             if (targetOverlay && targetOverlay.contains(unitTokenElement)) {
                 targetOverlay.removeChild(unitTokenElement);
             }
            const originalOverlay = originalHexWrapper.querySelector('.hexagon-content-overlay');
            if (originalOverlay && !originalOverlay.contains(unitTokenElement)) {
                 originalOverlay.appendChild(unitTokenElement);
            }
         }
        window.gameNS.populateUnitInfo?.(unitIdKey, true);
    }
};

/**
 * Exibe o círculo de alcance de ataque para a unidade ativa.
 * As miras nos alvos são responsabilidade de combat-logic.js.
 */
window.gameNS.displayAttackRange = function() {
    // console.log("[MOVEMENT-LOGIC displayAttackRange] Chamada (Apenas para mostrar o círculo).");
    if (!window.gameNS.activeUnitForAction?.originalHexWrapper || !window.gameNS.activeUnitForAction?.unitInstanceData) {
        console.warn("[MOVEMENT-LOGIC displayAttackRange] Contexto ativo ausente.");
        window.gameNS.clearActionHighlights?.();
        window.gameNS.clearUnitInfo?.();
        return;
    }

    const { unitData, originalHexWrapper, unitInstanceData, unitIdKey } = window.gameNS.activeUnitForAction;

    if (unitInstanceData.hasAttackedThisTurn) {
        // console.log(`[MOVEMENT-LOGIC displayAttackRange] Unidade ${unitIdKey} já atacou.`);
        alert("Esta unidade já atacou neste turno.");
        window.gameNS.clearActionHighlights?.();
        window.gameNS.populateUnitInfo?.(unitIdKey, true);
        return;
    }

    const attackRange = parseInt(unitInstanceData.currentAlcance);
    const baseAttackPower = parseInt(unitData["PODER DE FOGO"] || 0);


    if (isNaN(attackRange) || attackRange <= 0 || baseAttackPower <= 0) {
        // console.log(`[MOVEMENT-LOGIC displayAttackRange] Unidade ${unitIdKey} não pode atacar (alcance: ${attackRange}, poder: ${baseAttackPower}).`);
        alert(`Unidade ${unitData.NOME || 'selecionada'} não pode atacar (sem alcance ou poder de fogo).`);
        window.gameNS.clearActionHighlights?.();
        window.gameNS.populateUnitInfo?.(unitIdKey, true);
        return;
    }

    window.gameNS.clearActionHighlights?.(); // Limpa destaques anteriores (importante para não sobrepor com movimento)

    if (typeof window.showRangeIndicator === 'function') {
        window.showRangeIndicator(originalHexWrapper, attackRange, 'mira');
        // console.log(`[MOVEMENT-LOGIC displayAttackRange] Círculo de alcance (${attackRange}) mostrado.`);
    }
    // A lógica de mostrar miras (showAttackOptionsForUnit) é chamada SEPARADAMENTE
    // pelo handler do botão na UI, APÓS esta função.
};