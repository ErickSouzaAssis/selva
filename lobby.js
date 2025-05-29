// lobby.js
document.addEventListener('DOMContentLoaded', () => {
    // Elementos da Seção Criar Sala
    const btnGenerateId = document.getElementById('lobby-btn-generate-id');
    const createdRoomIdDisplay = document.getElementById('lobby-created-room-id-display');
    const shareIdInstructions = document.getElementById('lobby-share-id-instructions');
    const btnConfirmCreateRoom = document.getElementById('lobby-btn-confirm-create-room');
    const inputP1Name = document.getElementById('lobby-p1-name');
    const selectP1Country = document.getElementById('lobby-p1-country');

    // Elementos da Seção Entrar em Sala
    const btnJoinRoom = document.getElementById('lobby-btn-join-room');
    const inputJoinRoomId = document.getElementById('lobby-input-join-room-id');
    const inputP2Name = document.getElementById('lobby-p2-name');
    const selectP2Country = document.getElementById('lobby-p2-country');

    // Outros Elementos
    const messageArea = document.getElementById('lobby-message-area');
    const btnBackToMenu = document.getElementById('lobby-btn-back-to-menu');

    let generatedGameIdForCreator = null;

    // Função para gerar ID da sessão de jogo
    function generateGameSessionId() {
        const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `SELVA-${randomPart}`;
    }

    // Função para validar entradas do jogador
    function validatePlayerInputs(nameInput, countrySelect, messagePrefix) {
        const name = nameInput.value.trim();
        const country = countrySelect.value;

        if (!name) {
            if (messageArea) messageArea.textContent = `${messagePrefix}: Por favor, insira seu nome.`;
            nameInput.focus();
            return null;
        }
        if (!country) {
            if (messageArea) messageArea.textContent = `${messagePrefix}: Por favor, selecione seu país.`;
            countrySelect.focus();
            return null;
        }
        if (messageArea) messageArea.textContent = '';
        return { name, country };
    }

    if (btnGenerateId) {
        btnGenerateId.addEventListener('click', () => {
            const p1Info = validatePlayerInputs(inputP1Name, selectP1Country, "Criar Sala");
            if (!p1Info) {
                if (createdRoomIdDisplay) createdRoomIdDisplay.classList.add('hidden');
                if (shareIdInstructions) shareIdInstructions.classList.add('hidden');
                if (btnConfirmCreateRoom) btnConfirmCreateRoom.classList.add('hidden');
                btnGenerateId.disabled = false;
                btnGenerateId.textContent = "Gerar ID da Sala";
                inputP1Name.disabled = false;
                selectP1Country.disabled = false;
                return;
            }

            generatedGameIdForCreator = generateGameSessionId();
            if (createdRoomIdDisplay) {
                createdRoomIdDisplay.textContent = `${generatedGameIdForCreator}`;
                createdRoomIdDisplay.classList.remove('hidden');
            }
            if (shareIdInstructions) {
                shareIdInstructions.classList.remove('hidden');
            }
            if (btnConfirmCreateRoom) {
                btnConfirmCreateRoom.classList.remove('hidden');
            }
            if (messageArea) messageArea.textContent = 'ID da sala gerado! Copie e compartilhe.';

            btnGenerateId.disabled = true;
            btnGenerateId.textContent = "ID Gerado Abaixo!";
        });
    }

    if (btnConfirmCreateRoom) {
        btnConfirmCreateRoom.addEventListener('click', () => {
            if (!generatedGameIdForCreator) {
                if (messageArea) messageArea.textContent = 'Erro: Nenhum ID de sala foi gerado primeiro.';
                if (btnGenerateId) {
                    btnGenerateId.disabled = false;
                    btnGenerateId.textContent = "Gerar ID da Sala";
                }
                return;
            }
            const p1NameValue = inputP1Name.value.trim();
            const p1CountryValue = selectP1Country.value;

            if (!p1NameValue || !p1CountryValue) {
                 if (messageArea) messageArea.textContent = 'Criar Sala: Nome e País do Jogador 1 são obrigatórios.';
                 inputP1Name.disabled = false;
                 selectP1Country.disabled = false;
                 if (btnGenerateId) { 
                    btnGenerateId.disabled = false;
                    btnGenerateId.textContent = "Gerar ID da Sala";
                 }
                 return;
            }

            const gameRoomRef = window.database.ref('gameRooms/' + generatedGameIdForCreator);
            const initialRoomData = {
                player1: {
                    name: p1NameValue,
                    country: p1CountryValue
                },
                player2: null, 
                status: 'waiting_for_player2',
                currentTurnPlayerKey: 'player1',
                currentTurnNumber: 1,
                mapFile: "roraima_online.html", // Definindo o mapa online padrão
                placedUnits: {}, 
                gameStateLastUpdate: firebase.database.ServerValue.TIMESTAMP,
                winner: null,
                winReason: null,
                initialSetupCompletedBy: { player1: false, player2: false }
            };

            btnConfirmCreateRoom.disabled = true;
            btnConfirmCreateRoom.textContent = "Criando...";
            inputP1Name.disabled = true; 
            selectP1Country.disabled = true; 


            gameRoomRef.set(initialRoomData)
                .then(() => {
                    console.log(`Sala ${generatedGameIdForCreator} criada no Firebase.`);
                    if (messageArea) messageArea.textContent = `Sala ${generatedGameIdForCreator} criada! Compartilhe o ID.`;

                    localStorage.removeItem('gameSetupInfo');
                    localStorage.removeItem('loadedGameStateFromSlot');
                    localStorage.removeItem('selectedNewGameSlot');

                    const playerNameEncoded = encodeURIComponent(p1NameValue);
                    const playerCountryEncoded = encodeURIComponent(p1CountryValue);

                    console.log(`Redirecionando para sala online: ${generatedGameIdForCreator} como Jogador 1 (${p1NameValue}, ${p1CountryValue})`);
                    // MODIFICAÇÃO AQUI: Redirecionar para roraima_online.html
                    window.location.href = `roraima_online.html?gameId=${generatedGameIdForCreator}&playerKey=player1&playerName=${playerNameEncoded}&playerCountry=${playerCountryEncoded}`;
                })
                .catch(error => {
                    console.error("Erro ao criar sala no Firebase:", error);
                    if (messageArea) messageArea.textContent = 'Erro ao criar sala online. Verifique o console e tente novamente.';
                    if (btnGenerateId) btnGenerateId.disabled = false; 
                    inputP1Name.disabled = false;
                    selectP1Country.disabled = false;
                    btnConfirmCreateRoom.disabled = false;
                    btnConfirmCreateRoom.textContent = "Confirmar e Entrar na Sala";
                });
        });
    }

    if (btnJoinRoom) {
        btnJoinRoom.addEventListener('click', () => {
            const gameIdToJoin = inputJoinRoomId.value.trim();
            if (!gameIdToJoin) {
                if (messageArea) messageArea.textContent = 'Por favor, digite o ID da sala para entrar.';
                inputJoinRoomId.focus();
                return;
            }

            const p2Info = validatePlayerInputs(inputP2Name, selectP2Country, "Entrar na Sala");
            if (!p2Info) return;

            const gameRoomRef = window.database.ref('gameRooms/' + gameIdToJoin);

            btnJoinRoom.disabled = true;
            btnJoinRoom.innerHTML = 'Conectando...'; 

            gameRoomRef.once('value', (snapshot) => {
                console.log(`[LOBBY P2 - DEBUG] Tentando entrar na sala ${gameIdToJoin}. Dados lidos do Firebase:`, JSON.parse(JSON.stringify(snapshot.val())));

                if (snapshot.exists()) {
                    const roomData = snapshot.val();

                    if ((roomData.player2 === null || typeof roomData.player2 === 'undefined') && roomData.status === 'waiting_for_player2') {
                        const updates = {};
                        updates['player2'] = {
                            name: p2Info.name,
                            country: p2Info.country
                        };
                        updates['status'] = 'ongoing'; // Muda o status para 'ongoing' quando P2 entra
                        updates['gameStateLastUpdate'] = firebase.database.ServerValue.TIMESTAMP;
                        // Adiciona o nome do arquivo do mapa que P1 definiu, se não estiver lá (para garantir consistência)
                        if (!updates['mapFile'] && roomData.mapFile) {
                           updates['mapFile'] = roomData.mapFile;
                        } else if (!updates['mapFile'] && !roomData.mapFile) {
                           updates['mapFile'] = "roraima_online.html"; // Fallback
                        }


                        gameRoomRef.update(updates)
                            .then(() => {
                                console.log(`Jogador 2 (${p2Info.name}) entrou na sala ${gameIdToJoin}.`);
                                if (messageArea) messageArea.textContent = 'Entrando na sala...';

                                localStorage.removeItem('gameSetupInfo');
                                localStorage.removeItem('loadedGameStateFromSlot');
                                localStorage.removeItem('selectedNewGameSlot');

                                const playerNameEncoded = encodeURIComponent(p2Info.name);
                                const playerCountryEncoded = encodeURIComponent(p2Info.country);

                                // MODIFICAÇÃO AQUI: Redirecionar para roraima_online.html
                                window.location.href = `roraima_online.html?gameId=${gameIdToJoin}&playerKey=player2&playerName=${playerNameEncoded}&playerCountry=${playerCountryEncoded}`;
                            })
                            .catch(error => {
                                console.error("Erro ao J2 atualizar sala no Firebase:", error);
                                if (messageArea) messageArea.textContent = 'Erro ao tentar entrar na sala. Tente novamente.';
                                btnJoinRoom.disabled = false;
                                btnJoinRoom.innerHTML = ` <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" /></svg> ENTRAR`;
                            });
                    } else if (roomData.player2 !== null && typeof roomData.player2 !== 'undefined') {
                        if (messageArea) messageArea.textContent = 'Esta sala já está cheia.';
                        btnJoinRoom.disabled = false;
                        // Restaurar o conteúdo original do botão, incluindo o SVG
                        btnJoinRoom.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" /></svg> ENTRAR`;
                    } else { 
                        if (messageArea) messageArea.textContent = `Não é possível entrar nesta sala (status: ${roomData.status}, P2: ${JSON.stringify(roomData.player2)}).`;
                        btnJoinRoom.disabled = false;
                        btnJoinRoom.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" /></svg> ENTRAR`;
                    }
                } else {
                    if (messageArea) messageArea.textContent = 'ID da sala não encontrado.';
                    btnJoinRoom.disabled = false;
                    btnJoinRoom.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" /></svg> ENTRAR`;
                }
            }).catch(error => {
                console.error("Erro ao buscar sala no Firebase para J2:", error);
                if (messageArea) messageArea.textContent = 'Erro ao verificar ID da sala. Verifique o console.';
                btnJoinRoom.disabled = false;
                btnJoinRoom.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" /></svg> ENTRAR`;
            });

            if (createdRoomIdDisplay) createdRoomIdDisplay.classList.add('hidden');
            if (shareIdInstructions) shareIdInstructions.classList.add('hidden');
        });
    }

    if (btnBackToMenu) {
        btnBackToMenu.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }
});
