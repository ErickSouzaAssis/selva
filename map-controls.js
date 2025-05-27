// map-controls.js

window.gameNS = window.gameNS || {};

// --- Variáveis de Pan, Zoom e ROTAÇÃO específicas deste módulo ---
let mapCtrl_currentZoom = 1;
let mapCtrl_panX = 0;
let mapCtrl_panY = 0;
let mapCtrl_isPanning = false;
let mapCtrl_lastMouseX = 0;
let mapCtrl_lastMouseY = 0;
let mapCtrl_currentRotation = 0; // Nova variável para rotação em graus

const MAPCTRL_MIN_ZOOM = 0.75;
const MAPCTRL_MAX_ZOOM = 5.0;
const MAPCTRL_ZOOM_SENSITIVITY_WHEEL = 0.080;

let mapCtrl_gameBoardElement = null;
let mapCtrl_gridContainerElement = null;

// --- Funções Auxiliares ---

/**
 * Aplica a transformação de pan, zoom e ROTAÇÃO ao container do grid.
 */
function mapCtrl_applyTransform() {
    if (mapCtrl_gridContainerElement) {
        // A ordem das transformações importa: translação, depois rotação, depois escala.
        // Se a rotação for aplicada antes da translação, a translação ocorrerá no sistema de coordenadas rotacionado.
        // Para rotacionar em torno do centro do gridContainer, precisaríamos de cálculos mais complexos de transform-origin
        // ou aplicar translações adicionais.
        // Por simplicidade, vamos rotacionar em torno do canto (0,0) do grid-container (seu transform-origin CSS).
        // Se o transform-origin for 50% 50%, ele rotacionará em torno do seu centro.
        
        // Para rotacionar em torno do centro do grid-container e depois transladar e escalar:
        // 1. Transladar para o centro do grid
        // 2. Rotacionar
        // 3. Transladar de volta da origem do centro
        // 4. Aplicar Pan
        // 5. Escalar
        // Isso é mais complexo. A forma mais simples é:
        // mapCtrl_gridContainerElement.style.transform = `translate(${Math.round(mapCtrl_panX)}px, ${Math.round(mapCtrl_panY)}px) rotate(${mapCtrl_currentRotation}deg) scale(${mapCtrl_currentZoom})`;
        // No entanto, a rotação afeta a percepção do pan.
        
        // Vamos tentar uma abordagem onde o transform-origin do grid-container é central
        // e o pan e zoom são aplicados ao redor disso.
        // CSS para #grid-container precisaria de: transform-origin: center center;
        // Mas isso complica o zoom no cursor.
        
        // Melhor manter transform-origin: 0 0 e ajustar o pan para compensar a rotação se necessário,
        // ou aceitar que a rotação é em torno do canto 0,0 do grid container.
        // Se o #grid-container tiver `transform-origin: 0 0;` (que é o padrão ou o que você configurou)
        mapCtrl_gridContainerElement.style.transform = 
            `translate(${Math.round(mapCtrl_panX)}px, ${Math.round(mapCtrl_panY)}px) ` +
            `rotate(${mapCtrl_currentRotation}deg) ` +
            `scale(${mapCtrl_currentZoom})`;

        // IMPORTANTE: Rotacionar o grid-container pode fazer com que ele "saia" da área visível
        // do game-board, pois a rotação muda seu bounding box.
        // O pan e zoom podem precisar ser ajustados para manter o conteúdo visível após a rotação.
        // Para uma rotação simples de 90 graus, o impacto no pan e zoom pode ser significativo.
        // O ideal seria rotacionar em torno do centro da *tela visível atual* ou do centro do *mapa visível*.
    }
}

/**
 * Aplica zoom em um ponto específico do mapa (geralmente o cursor do mouse).
 * A rotação NÃO é afetada diretamente por esta função, mas a percepção visual sim.
 */
function mapCtrl_zoomAtPoint(newZoomLevelTarget, mouseXInBoardRelative, mouseYInBoardRelative) {
    if (!mapCtrl_gameBoardElement) {
        console.warn("[MapControls zoomAtPoint] gameBoardElement não está definido.");
        return;
    }

    // As coordenadas do mouse são relativas ao gameBoard, que não gira.
    // O panX e panY são no sistema de coordenadas não rotacionado do gridContainer.
    // A rotação é aplicada DEPOIS do translate pelo panX/panY.

    // Coordenadas do ponto no conteúdo (grid) sob o mouse ANTES do zoom.
    // Estes cálculos precisam levar em conta a rotação se quisermos que o ponto sob o mouse
    // permaneça fixo após o zoom QUANDO O MAPA ESTÁ ROTACIONADO.
    // Isso se torna complexo rapidamente.
    // Por ora, vamos manter o zoom no cursor funcionando como se não houvesse rotação,
    // o que significa que o "ponto fixo" do zoom pode parecer deslocar-se se o mapa estiver rotacionado.
    // Para uma implementação simples, o zoom ainda será relativo ao (0,0) do gridContainer (antes da rotação).

    const currentZoom = mapCtrl_currentZoom; // Salva o zoom atual antes da mudança

    // Calcula as coordenadas do ponto no conteúdo (grid) ANTES do zoom
    // Este cálculo é no sistema de coordenadas NÃO rotacionado do grid.
    const contentMouseX_unrotated = (mouseXInBoardRelative - mapCtrl_panX) / currentZoom;
    const contentMouseY_unrotated = (mouseYInBoardRelative - mapCtrl_panY) / currentZoom;

    mapCtrl_currentZoom = Math.max(MAPCTRL_MIN_ZOOM, Math.min(MAPCTRL_MAX_ZOOM, newZoomLevelTarget));

    // Ajusta o pan para que o ponto (não rotacionado) sob o mouse permaneça na mesma posição na tela
    mapCtrl_panX = mouseXInBoardRelative - (contentMouseX_unrotated * mapCtrl_currentZoom);
    mapCtrl_panY = mouseYInBoardRelative - (contentMouseY_unrotated * mapCtrl_currentZoom);

    mapCtrl_applyTransform();
}


window.gameNS.mapControls = {
    getCurrentZoom: () => mapCtrl_currentZoom,
    getCurrentPanX: () => mapCtrl_panX,
    getCurrentPanY: () => mapCtrl_panY,
    getCurrentRotation: () => mapCtrl_currentRotation, // Exporta a rotação
    resetView: function() {
        const resetViewButton = document.getElementById('reset-view-button');
        if (resetViewButton && typeof resetViewButton.click === 'function') {
            resetViewButton.click();
        } else {
            console.warn("[MapControls public resetView] Botão de reset não encontrado ou não clicável.");
        }
    }
};

window.gameNS.initializeMapControls = function() {
    console.log("[MapControls initializeMapControls] Iniciando controles de pan, zoom e rotação.");
    mapCtrl_gameBoardElement = document.getElementById('game-board');
    mapCtrl_gridContainerElement = document.getElementById('grid-container');

    if (!mapCtrl_gameBoardElement || !mapCtrl_gridContainerElement) {
        console.error("[MapControls initializeMapControls] ERRO CRÍTICO: Elementos #game-board ou #grid-container não foram encontrados no DOM!");
        alert("Erro: Controles do mapa não puderam ser inicializados.");
        return;
    }

    mapCtrl_applyTransform();

    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');
    const resetViewButton = document.getElementById('reset-view-button');
    const rotateLeftButton = document.getElementById('rotate-left-button'); // Novo
    const rotateRightButton = document.getElementById('rotate-right-button'); // Novo

    if (zoomInButton) {
        zoomInButton.addEventListener('click', () => {
            if (!mapCtrl_gameBoardElement) return;
            mapCtrl_zoomAtPoint(mapCtrl_currentZoom * (1 + MAPCTRL_ZOOM_SENSITIVITY_WHEEL), mapCtrl_gameBoardElement.offsetWidth / 2, mapCtrl_gameBoardElement.offsetHeight / 2);
        });
    } else { console.warn("[MapControls] Botão #zoom-in-button não encontrado."); }

    if (zoomOutButton) {
        zoomOutButton.addEventListener('click', () => {
            if (!mapCtrl_gameBoardElement) return;
            mapCtrl_zoomAtPoint(mapCtrl_currentZoom / (1 + MAPCTRL_ZOOM_SENSITIVITY_WHEEL), mapCtrl_gameBoardElement.offsetWidth / 2, mapCtrl_gameBoardElement.offsetHeight / 2);
        });
    } else { console.warn("[MapControls] Botão #zoom-out-button não encontrado."); }

    if (resetViewButton) {
        resetViewButton.addEventListener('click', () => {
            if (!mapCtrl_gameBoardElement || !mapCtrl_gridContainerElement) {
                console.warn("[MapControls ResetView] Elementos do mapa não encontrados.");
                return;
            }
            
            mapCtrl_currentZoom = MAPCTRL_MIN_ZOOM;
            mapCtrl_panX = 10; // Margem esquerda de 10px
            mapCtrl_currentRotation = 0; // Reseta a rotação também

            const gridHeight = mapCtrl_gridContainerElement.scrollHeight;
            if (gridHeight > 0 && mapCtrl_gameBoardElement.offsetHeight > 0) {
                mapCtrl_panY = (mapCtrl_gameBoardElement.offsetHeight - (gridHeight * mapCtrl_currentZoom)) / 2;
            } else {
                mapCtrl_panY = (mapCtrl_gameBoardElement.offsetHeight / 2) * (1 - mapCtrl_currentZoom) ; 
                console.warn("[MapControls ResetView] Dimensões do gridContainer (scrollHeight) ou gameBoardElement (offsetHeight) são zero ou inválidas. Centralização vertical pode ser imprecisa.");
            }
            
            mapCtrl_applyTransform();
            console.log(`[MapControls] Vista do mapa resetada: Zoom=${mapCtrl_currentZoom}, PanX=${mapCtrl_panX}, PanY=${mapCtrl_panY}, Rotação=${mapCtrl_currentRotation}`);
        });
    } else { console.warn("[MapControls] Botão #reset-view-button não encontrado."); }

    // Listeners para os botões de rotação
    if (rotateLeftButton) {
        rotateLeftButton.addEventListener('click', () => {
            mapCtrl_currentRotation -= 90;
            // Normaliza a rotação para ficar entre 0 e 359 (opcional, mas bom para consistência)
            // mapCtrl_currentRotation = (mapCtrl_currentRotation % 360 + 360) % 360; 
            mapCtrl_applyTransform();
            console.log(`[MapControls] Rotação para ${mapCtrl_currentRotation}deg`);
        });
    } else { console.warn("[MapControls] Botão #rotate-left-button não encontrado."); }

    if (rotateRightButton) {
        rotateRightButton.addEventListener('click', () => {
            mapCtrl_currentRotation += 90;
            // mapCtrl_currentRotation = (mapCtrl_currentRotation % 360 + 360) % 360;
            mapCtrl_applyTransform();
            console.log(`[MapControls] Rotação para ${mapCtrl_currentRotation}deg`);
        });
    } else { console.warn("[MapControls] Botão #rotate-right-button não encontrado."); }


    // --- Listener para Pan do Mapa (Arrastar com o Mouse) ---
    // O pan existente funciona no sistema de coordenadas não rotacionado.
    // Se o mapa estiver rotacionado, o movimento do mouse "para cima" pode não transladar o mapa "para cima" visualmente.
    // Para um pan intuitivo em um mapa rotacionado, os deltas do mouse (dx, dy) precisariam ser rotacionados
    // pela inversa da rotação atual do mapa antes de serem adicionados a mapCtrl_panX e mapCtrl_panY.
    // Esta é uma complexidade adicional. Por ora, o pan funcionará como antes.
    mapCtrl_gameBoardElement.addEventListener('mousedown', (e) => {
        const clickedToken = e.target.closest('.unit-map-token');
        if (clickedToken) return; 
        if (window.gameNS.activeUnitForAction) return;
        if (e.button === 0) { 
            mapCtrl_isPanning = true;
            mapCtrl_lastMouseX = e.clientX;
            mapCtrl_lastMouseY = e.clientY;
            if(mapCtrl_gameBoardElement) mapCtrl_gameBoardElement.style.cursor = 'grabbing';
            if (window.gameNS?.hideHexInfo) window.gameNS.hideHexInfo();
        }
    });

    mapCtrl_gameBoardElement.addEventListener('wheel', (e) => {
        e.preventDefault(); 
        if (!mapCtrl_gameBoardElement) return;
        const rect = mapCtrl_gameBoardElement.getBoundingClientRect();
        const mouseXInBoard = e.clientX - rect.left;
        const mouseYInBoard = e.clientY - rect.top;
        let newZoomTarget = e.deltaY < 0 
            ? mapCtrl_currentZoom * (1 + MAPCTRL_ZOOM_SENSITIVITY_WHEEL) 
            : mapCtrl_currentZoom / (1 + MAPCTRL_ZOOM_SENSITIVITY_WHEEL);
        mapCtrl_zoomAtPoint(newZoomTarget, mouseXInBoard, mouseYInBoard);
    }, { passive: false });

    window.addEventListener('mousemove', (e) => {
        if(mapCtrl_isPanning){
            let dx = e.clientX - mapCtrl_lastMouseX;
            let dy = e.clientY - mapCtrl_lastMouseY;

            // Para pan intuitivo com rotação:
            // Se mapCtrl_currentRotation não for 0, precisamos ajustar dx e dy.
            // Esta é uma simplificação. Uma rotação completa exigiria trigonometria.
            // Se o mapa estiver rotacionado em 90 graus:
            // - Mover mouse para direita (dx positivo) deveria mover o mapa para a "direita visual".
            //   Se o mapa está girado 90 graus no sentido horário, a "direita visual" é o "para baixo" original.
            //   Então, dx do mouse se torna dy do pan. dy do mouse se torna -dx do pan.
            // Se o mapa está girado -90 graus (ou 270):
            // - Mover mouse para direita (dx positivo) -> "para cima" original. dy do mouse -> dx do pan.
            
            // Simplificação: não ajusta o pan pela rotação por enquanto.
            // O pan ainda ocorre nos eixos X e Y do grid não rotacionado.

            mapCtrl_panX += dx;
            mapCtrl_panY += dy;

            mapCtrl_lastMouseX = e.clientX;
            mapCtrl_lastMouseY = e.clientY;

            mapCtrl_applyTransform();
        }
    });

    window.addEventListener('mouseup', (e) => {
        if(mapCtrl_isPanning && e.button === 0){ 
            mapCtrl_isPanning = false;
            if(mapCtrl_gameBoardElement) mapCtrl_gameBoardElement.style.cursor = 'grab';
        }
    });

    console.log("[MapControls initializeMapControls] Controles de mapa (pan/zoom/rotação) configurados e prontos.");
};