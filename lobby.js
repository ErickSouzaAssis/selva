// lobby.js
document.addEventListener('DOMContentLoaded', () => {
    const btnCreateRoom = document.getElementById('lobby-btn-create-room');
    const createdRoomIdDisplay = document.getElementById('lobby-created-room-id-display');
    const shareIdInstructions = document.getElementById('lobby-share-id-instructions');
    const btnConfirmCreateRoom = document.getElementById('lobby-btn-confirm-create-room'); // Novo botão

    const btnJoinRoom = document.getElementById('lobby-btn-join-room');
    const inputJoinRoomId = document.getElementById('lobby-input-join-room-id');
    const messageArea = document.getElementById('lobby-message-area');
    const btnBackToMenu = document.getElementById('lobby-btn-back-to-menu');

    let generatedGameIdForCreator = null; // Variável para armazenar o ID gerado

    function generateGameSessionId() {
        const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `SELVA-${randomPart}`;
    }

    if (btnCreateRoom) {
        btnCreateRoom.addEventListener('click', () => {
            generatedGameIdForCreator = generateGameSessionId(); // Armazena o ID
            if (createdRoomIdDisplay) {
                createdRoomIdDisplay.textContent = `${generatedGameIdForCreator}`;
                createdRoomIdDisplay.classList.remove('hidden');
            }
            if (shareIdInstructions) {
                shareIdInstructions.classList.remove('hidden');
            }
            if (btnConfirmCreateRoom) {
                btnConfirmCreateRoom.classList.remove('hidden'); // Mostra o botão de confirmar
            }
            if (messageArea) messageArea.textContent = '';

            // Opcional: Desabilitar o botão de gerar ID para evitar múltiplos cliques
            btnCreateRoom.disabled = true;
            btnCreateRoom.textContent = "ID Gerado!";
        });
    }

    if (btnConfirmCreateRoom) {
        btnConfirmCreateRoom.addEventListener('click', () => {
            if (!generatedGameIdForCreator) {
                if (messageArea) messageArea.textContent = 'Erro: Nenhum ID de sala foi gerado.';
                return;
            }

            localStorage.removeItem('gameSetupInfo');
            localStorage.removeItem('loadedGameStateFromSlot');
            localStorage.removeItem('selectedNewGameSlot');

            console.log(`Redirecionando para criar sala: ${generatedGameIdForCreator} como Jogador 1`);
            window.location.href = `mapa_roraima.html?gameId=${generatedGameIdForCreator}&playerKey=player1`;
        });
    }

    if (btnJoinRoom) {
        btnJoinRoom.addEventListener('click', () => {
            const gameIdToJoin = inputJoinRoomId.value.trim();
            if (!gameIdToJoin) {
                if (messageArea) messageArea.textContent = 'Por favor, digite o ID da sala para entrar.';
                return;
            }
            if (messageArea) messageArea.textContent = '';
            if (createdRoomIdDisplay) createdRoomIdDisplay.classList.add('hidden');
            if (shareIdInstructions) shareIdInstructions.classList.add('hidden');


            localStorage.removeItem('gameSetupInfo');
            localStorage.removeItem('loadedGameStateFromSlot');
            localStorage.removeItem('selectedNewGameSlot');

            console.log(`Redirecionando para entrar na sala: ${gameIdToJoin} como Jogador 2`);
            window.location.href = `mapa_roraima.html?gameId=${gameIdToJoin}&playerKey=player2`;
        });
    }

    if (btnBackToMenu) {
        btnBackToMenu.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }
});