document.addEventListener('DOMContentLoaded', function() {
    const sendButton = document.getElementById('send-button');
    const voiceButton = document.getElementById('voice-button');
    const userInput = document.getElementById('user-input');
    const conversationHistory = document.getElementById('conversation-history');
    const asistente = document.querySelector('.asistente');
    const statusText = document.getElementById('status-text');
    
    let isVoiceMode = false;
    let currentAudio = null;
    let recognition = null;
    let isListening = false;
    let lastTextSent = '';
    
    // Configurar reconocimiento de voz
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-MX';
        
        recognition.onstart = function() {
            isListening = true;
            asistente.classList.add('escuchando');
            statusText.textContent = "Escuchando...";
        };
        
        recognition.onend = function() {
            if (isVoiceMode) {
                // Si estamos en modo voz, reiniciamos el reconocimiento
                setTimeout(() => {
                    if (isVoiceMode) {
                        recognition.start();
                    }
                }, 500);
            } else {
                isListening = false;
                asistente.classList.remove('escuchando');
                statusText.textContent = "Listo para asistirte";
            }
        };
        
        recognition.onresult = function(event) {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (finalTranscript && finalTranscript.trim() !== '') {
                // Si hay una transcripción final, procesarla
                procesarMensajeVoz(finalTranscript);
            }
        };
        
        recognition.onerror = function(event) {
            console.error('Error en reconocimiento de voz:', event.error);
            if (event.error === 'no-speech') {
                // No hacer nada, es común en periodos de silencio
            } else {
                statusText.textContent = `Error: ${event.error}`;
                isVoiceMode = false;
                voiceButton.classList.remove('active');
                asistente.classList.remove('escuchando');
            }
        };
    } else {
        voiceButton.style.display = 'none';
        alert('Tu navegador no soporta reconocimiento de voz. Esta funcionalidad no estará disponible.');
    }
    
    sendButton.addEventListener('click', sendTextMessage);
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendTextMessage();
    });
    
    voiceButton.addEventListener('click', toggleVoiceMode);
    
    function toggleVoiceMode() {
        isVoiceMode = !isVoiceMode;
        
        if (isVoiceMode) {
            // Cambiar a modo de voz
            voiceButton.classList.add('active');
            userInput.placeholder = "Modo voz activado...";
            userInput.disabled = true;
            sendButton.disabled = true;
            
            // Detener cualquier audio que se esté reproduciendo
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
                asistente.classList.remove('hablando');
            }
            
            // Iniciar reconocimiento de voz
            recognition.start();
        } else {
            // Volver a modo de texto
            voiceButton.classList.remove('active');
            userInput.placeholder = "Escribe tu consulta aquí...";
            userInput.disabled = false;
            sendButton.disabled = false;
            
            // Detener reconocimiento de voz
            if (recognition) {
                recognition.stop();
            }
            
            asistente.classList.remove('escuchando');
            statusText.textContent = "Listo para asistirte";
        }
    }

    
// modificar esta funcion #####################33
    function procesarMensajeVoz(mensaje) {
        // Evitar duplicados (a veces el reconocimiento retorna el mismo texto)
        if (mensaje.trim() === lastTextSent) {
            return;
        }
        lastTextSent = mensaje.trim();
        
        // Si hay audio reproduciéndose, detenerlo
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
            asistente.classList.remove('hablando');
        }
        
        // Agregar mensaje del usuario al historial
        addMessageToHistory('user', mensaje);
        
        // Cambiar estado a procesando/pensando
        statusText.textContent = "Procesando tu consulta...";
        asistente.classList.remove('escuchando');
        asistente.classList.add('pensando');
        
        // Enviar mensaje al servidor
        fetch('http://localhost:5000/consultar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: mensaje })
        })
        .then(response => response.json())
        .then(data => {
            // Quitar el estado "pensando"
            asistente.classList.remove('pensando');
            
            if (data.error) {
                addMessageToHistory('jarvis', `Lo siento, ha ocurrido un error: ${data.error}`);
                return;
            }
            
            // Agregar respuesta de JARVIS al historial
            addMessageToHistory('jarvis', data.texto);
            
            // Reproducir audio si está disponible
            if (data.audio) {
                const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
                currentAudio = audio;
                
                audio.onplay = () => {
                    asistente.classList.add('hablando');
                    statusText.textContent = "Hablando...";
                };
                
                audio.onended = () => {
                    asistente.classList.remove('hablando');
                    
                    // Solo volvemos al estado de escucha si seguimos en modo voz
                    if (isVoiceMode) {
                        asistente.classList.add('escuchando');
                        statusText.textContent = "Escuchando...";
                    } else {
                        statusText.textContent = "Listo para asistirte";
                    }
                    
                    currentAudio = null;
                };
                
                audio.play().catch(e => {
                    console.error("Error al reproducir audio:", e);
                    statusText.textContent = "Error al reproducir audio";
                    currentAudio = null;
                });
            } else {
                if (isVoiceMode) {
                    asistente.classList.add('escuchando');
                    statusText.textContent = "Escuchando...";
                } else {
                    statusText.textContent = "Listo para asistirte";
                }
            }
        })
        .catch(error => {
            console.error("Error en la comunicación:", error);
            asistente.classList.remove('pensando');
            addMessageToHistory('jarvis', "Lo siento, ha ocurrido un error de comunicación. Inténtalo de nuevo más tarde.");
            statusText.textContent = "Error de conexión";
            
            if (isVoiceMode) {
                setTimeout(() => {
                    asistente.classList.add('escuchando');
                    statusText.textContent = "Escuchando...";
                }, 2000);
            }
        });
    }
    
    function sendTextMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // Detener cualquier audio que se esté reproduciendo
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
            asistente.classList.remove('hablando');
        }
        
        // Deshabilitar input durante el procesamiento
        sendButton.disabled = true;
        userInput.disabled = true;
        statusText.textContent = "Procesando tu consulta...";
        
        // Agregar mensaje del usuario al historial
        addMessageToHistory('user', message);
        userInput.value = '';
        
        // Cambiar a modo pensando
        asistente.classList.add('pensando');
        statusText.textContent = "Analizando información...";
        
        // Enviar consulta al servidor
        fetch('http://localhost:5000/consultar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: message })
        })
        .then(response => response.json())
        .then(data => {
            // Quitar el estado "pensando"
            asistente.classList.remove('pensando');
            
            if (data.error) {
                addMessageToHistory('jarvis', `Lo siento, ha ocurrido un error: ${data.error}`);
                return;
            }
            
            // Agregar respuesta de JARVIS al historial
            addMessageToHistory('jarvis', data.texto);
            
            // Reproducir audio si está disponible
            if (data.audio) {
                const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
                currentAudio = audio;
                
                audio.onplay = () => {
                    asistente.classList.add('hablando');
                    statusText.textContent = "Hablando...";
                };
                
                audio.onended = () => {
                    asistente.classList.remove('hablando');
                    statusText.textContent = "Listo para asistirte";
                    currentAudio = null;
                };
                
                audio.play().catch(e => {
                    console.error("Error al reproducir audio:", e);
                    statusText.textContent = "Error al reproducir audio";
                    currentAudio = null;
                });
            } else {
                statusText.textContent = "Listo para asistirte";
            }
        })
        .catch(error => {
            console.error("Error en la comunicación:", error);
            asistente.classList.remove('pensando');
            addMessageToHistory('jarvis', "Lo siento, ha ocurrido un error de comunicación. Inténtalo de nuevo más tarde.");
            statusText.textContent = "Error de conexión";
        })
        .finally(() => {
            // Habilitar input nuevamente
            sendButton.disabled = false;
            userInput.disabled = false;
            
            // Enfocar el input para la siguiente consulta
            userInput.focus();
        });
    }
    
    // Función para agregar mensajes al historial
    function addMessageToHistory(type, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type === 'user' ? 'user-message' : 'jarvis-message'}`;
        
        const now = new Date();
        const time = now.getHours().toString().padStart(2, '0') + ':' + 
                     now.getMinutes().toString().padStart(2, '0');
        
        messageDiv.innerHTML = `
            <div class="message-bubble">${text}</div>
            <span class="message-time">${time}</span>
        `;
        
        conversationHistory.appendChild(messageDiv);
        conversationHistory.scrollTop = conversationHistory.scrollHeight;
    }
    
    // Detector de actividad de voz para interrupciones
    document.addEventListener('keydown', function(e) {
        // Si presiona cualquier tecla mientras JARVIS está hablando, lo interrumpimos
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
            asistente.classList.remove('hablando');
            
            if (isVoiceMode) {
                asistente.classList.add('escuchando');
                statusText.textContent = "Escuchando...";
            } else {
                statusText.textContent = "Listo para asistirte";
            }
        }
    });
    
    // Mensaje de bienvenida inicial
    setTimeout(() => {
        asistente.classList.add('hablando');
        statusText.textContent = "Hablando...";
        
        setTimeout(() => {
            asistente.classList.remove('hablando');
            statusText.textContent = "Listo para asistirte";
        }, 2000);
    }, 1000);
});