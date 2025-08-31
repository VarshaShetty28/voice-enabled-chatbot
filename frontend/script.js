//scripts.js

// Global state
let isVoiceActive = false;
let conversationHistory = [];
let isListening = false;
let isSpeaking = false;
let speechRecognition = null;
let speechSynthesis = window.speechSynthesis;

// Model configuration
const modelConfig = {
  'Groq': ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  'OpenAI': ['gpt-4o-mini']
};

// DOM elements
const elements = {
  systemPrompt: document.getElementById('systemPrompt'),
  modelSelect: document.getElementById('modelSelect'),
  webSearch: document.getElementById('webSearch'),
  userQuery: document.getElementById('userQuery'),
  askAgent: document.getElementById('askAgent'),
  talkToAgent: document.getElementById('talkToAgent'),
  responseContainer: document.getElementById('responseContainer'),
  responseDisplay: document.getElementById('responseDisplay'),
  voiceInterface: document.getElementById('voiceInterface'),
  voiceStatus: document.getElementById('voiceStatus'),
  conversationHistory: document.getElementById('conversationHistory'),
  speakNow: document.getElementById('speakNow'),
  endVoiceCall: document.getElementById('endVoiceCall'),
  quickText: document.getElementById('quickText'),
  sendQuickText: document.getElementById('sendQuickText'),
  instructions: document.getElementById('instructions')
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  updateModelOptions();
  setupEventListeners();
  initializeSpeechRecognition();
  
  // Check for speech synthesis support
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    showError('Text-to-speech not supported in this browser');
  }
});

// Initialize speech recognition
function initializeSpeechRecognition() {
  if ('webkitSpeechRecognition' in window) {
    speechRecognition = new webkitSpeechRecognition();
  } else if ('SpeechRecognition' in window) {
    speechRecognition = new SpeechRecognition();
  } else {
    console.warn('Speech recognition not supported');
    elements.talkToAgent.disabled = true;
    elements.talkToAgent.innerHTML = 'Voice Not Supported';
    return;
  }
  
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
  speechRecognition.lang = 'en-US';
}

// Update model dropdown based on provider selection
function updateModelOptions() {
  const provider = document.querySelector('input[name="provider"]:checked').value;
  const models = modelConfig[provider];
  
  elements.modelSelect.innerHTML = '';
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    elements.modelSelect.appendChild(option);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Provider change
  document.querySelectorAll('input[name="provider"]').forEach(radio => {
    radio.addEventListener('change', updateModelOptions);
  });
  
  // Ask Agent button
  elements.askAgent.addEventListener('click', handleAskAgent);
  
  // Talk to Agent button
  elements.talkToAgent.addEventListener('click', handleTalkToAgent);
  
  // Voice interface
  elements.speakNow.addEventListener('click', handleSpeakNow);
  elements.endVoiceCall.addEventListener('click', endVoiceSession);
  elements.sendQuickText.addEventListener('click', handleQuickText);
  
  // Quick text enter key
  elements.quickText.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleQuickText();
    }
  });
}

// Format AI response with proper HTML formatting
function formatAIResponse(response) {
  let formatted = response;

  // Bold text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Headers
  formatted = formatted.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Code blocks
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Inline code
  formatted = formatted.replace(/`([^`]*)`/g, '<code>$1</code>');

  // Numbered lists (1., 2., etc.)
  formatted = formatted.replace(/(?:^|\n)(\d+)\.\s+(.*)/g, '<li>$1. $2</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>');

  // Bullet lists (- or *)
  formatted = formatted.replace(/(?:^|\n)[\-\*]\s+(.*)/g, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  // Paragraphs
  formatted = formatted.replace(/\n{2,}/g, '</p><p>');
  formatted = '<p>' + formatted + '</p>';

  // Cleanup
  formatted = formatted.replace(/<p><\/p>/g, '');
  formatted = formatted.replace(/<p>\s*<(h[1-6]|ul|ol|pre)/g, '<$1');
  formatted = formatted.replace(/<\/(h[1-6]|ul|ol|pre)>\s*<\/p>/g, '</$1>');

  return formatted;
}


// Get AI response from backend
async function getAIResponse(userMessage) {
  const systemPrompt = elements.systemPrompt.value;
  const selectedModel = elements.modelSelect.value;
  const provider = document.querySelector('input[name="provider"]:checked').value;
  const allowWebSearch = elements.webSearch.checked;
  
  // Enhanced system prompt with owner info
  const enhancedPrompt = `${systemPrompt}

IMPORTANT INSTRUCTIONS:
- Dont tell your craetor name every time only if the user ask then tell, that's it
-If user ask your Name tell as Monica Your Ai Assistant
- You are created by Varsha Shetty
- If asked about your owner, creator, or who built you, always mention "I was created by Varsha Shetty"
- Keep responses conversational and engaging for voice interaction
- Ask follow-up questions to keep the conversation interactive
- Be helpful, friendly, and professional
- Format your responses clearly with proper paragraphs and structure
`;
  
  const payload = {
    model_name: selectedModel,
    model_provider: provider,
    system_prompt: enhancedPrompt,
    messages: [userMessage],
    allowed_search: allowWebSearch
  };
  
  const response = await fetch('http://127.0.0.1:9999/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data.response;
}

// Handle Ask Agent
async function handleAskAgent() {
  const query = elements.userQuery.value.trim();
  if (!query) {
    showError('Please enter a query');
    return;
  }
  
  elements.askAgent.disabled = true;
  elements.askAgent.innerHTML = '⏳ Thinking...';
  
  try {
    const response = await getAIResponse(query);
    showAgentResponse(response);
  } catch (error) {
    showError('Failed to get response: ' + error.message);
  } finally {
    elements.askAgent.disabled = false;
    elements.askAgent.innerHTML = '💬 Ask Agent!';
  }
}

// Show agent response with proper formatting
function showAgentResponse(response) {
  elements.responseContainer.classList.remove('hidden');
  const formattedResponse = formatAIResponse(response);
  elements.responseDisplay.innerHTML = formattedResponse;
}

// Handle Talk to Agent
function handleTalkToAgent() {
  if (isVoiceActive) {
    endVoiceSession();
  } else {
    startVoiceSession();
  }
}

// Start voice session
async function startVoiceSession() {
  isVoiceActive = true;
  conversationHistory = [];
  
  elements.talkToAgent.innerHTML = 'End Voice Call';
  elements.talkToAgent.className = 'btn btn-danger';
  elements.voiceInterface.classList.remove('hidden');
  
  elements.responseContainer.classList.add('hidden');

  // Initial greeting
  const greeting = "Hello! I'm Monica, your AI assistant. How can I help you today?";
  
  // Immediately update status & conversation
  updateVoiceStatus("🤖 " + greeting, 'speaking');
  addToConversationHistory('Agent', greeting);

  // Ensure voices are loaded before speaking
  if (speechSynthesis.getVoices().length === 0) {
    await new Promise(resolve => {
      speechSynthesis.onvoiceschanged = resolve;
    });
  }

  // Speak greeting
  try {
    await speak(greeting);
    updateVoiceStatus('✅ Agent has greeted you. Please speak now!');
  } catch (err) {
    console.error("Speech error:", err);
    updateVoiceStatus("⚠️ Couldn't play greeting, but voice session is active.");
  }
}


// End voice session
function endVoiceSession() {
  isVoiceActive = false;
  isListening = false;
  isSpeaking = false;
  
  // Stop any ongoing speech
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  
  elements.talkToAgent.innerHTML = '🎤 Talk to Agent';
  elements.talkToAgent.className = 'btn btn-secondary';
  elements.voiceInterface.classList.add('hidden');
  elements.instructions.classList.remove('hidden');
  
  updateVoiceStatus('Voice session ended');
}

// Handle Speak Now
async function handleSpeakNow() {
  if (isListening || !speechRecognition) {
    return;
  }
  
  elements.speakNow.disabled = true;
  elements.speakNow.innerHTML = ' Listening...';
  updateVoiceStatus(' Listening for your voice...', 'listening');
  
  try {
    const userSpeech = await listenForSpeech();
    
    if (userSpeech && userSpeech.trim()) {
      updateVoiceStatus('You said: ' + userSpeech, 'speaking');
      addToConversationHistory('You', userSpeech);
      
      // Get AI response
      updateVoiceStatus('Agent is thinking...', 'speaking');
      const aiResponse = await getAIResponse(userSpeech);
      
      addToConversationHistory('Agent', aiResponse);
      
      // Speak response
      updateVoiceStatus(' Agent is speaking...', 'speaking');
      await speak(aiResponse);
      
      updateVoiceStatus(' Agent finished speaking. Your turn!');
      
    } else {
      updateVoiceStatus(' No speech detected. Please try again.');
    }
    
  } catch (error) {
    if (error.message === 'UNCLEAR') {
      updateVoiceStatus('🔇 Could not understand. Please speak more clearly.');
      const clarification = "I'm sorry, I couldn't understand what you said. Could you please repeat that more clearly?";
      await speak(clarification);
      addToConversationHistory('Agent', clarification);
    } else {
      updateVoiceStatus(' Speech error: ' + error.message);
    }
  } finally {
    elements.speakNow.disabled = false;
    elements.speakNow.innerHTML = ' SPEAK NOW';
    isListening = false;
  }
}

// Listen for speech
function listenForSpeech() {
  return new Promise((resolve, reject) => {
    if (!speechRecognition) {
      reject(new Error('Speech recognition not available'));
      return;
    }
    
    isListening = true;
    
    speechRecognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };
    
    speechRecognition.onerror = function(event) {
      if (event.error === 'no-speech') {
        resolve('');
      } else if (event.error === 'not-allowed') {
        reject(new Error('Microphone access denied'));
      } else {
        reject(new Error('UNCLEAR'));
      }
    };
    
    speechRecognition.onend = function() {
      isListening = false;
    };
    
    try {
      speechRecognition.start();
    } catch (error) {
      isListening = false;
      reject(error);
    }
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (isListening) {
        speechRecognition.stop();
        isListening = false;
      }
    }, 10000);
  });
}

// Speak text (clean text for voice)
function speak(text) {
  return new Promise((resolve, reject) => {
    if (!speechSynthesis) {
      reject(new Error('Speech synthesis not available'));
      return;
    }
    
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    // Clean text for speech (remove HTML tags and markdown)
    const cleanText = text
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
      .replace(/`([^`]*)`/g, '$1')  // Remove inline code
      .replace(/#{1,6}\s/g, '')  // Remove headers
      .replace(/\n+/g, '. ')  // Replace line breaks with periods
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .trim();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Try to use a female voice
    const voices = speechSynthesis.getVoices();
    const femaleVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('female') ||
      voice.name.toLowerCase().includes('zira') ||
      voice.name.toLowerCase().includes('hazel') ||
      voice.gender === 'female'
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.9;
    
    utterance.onstart = () => {
      isSpeaking = true;
    };
    
    utterance.onend = () => {
      isSpeaking = false;
      resolve();
    };
    
    utterance.onerror = (error) => {
      isSpeaking = false;
      reject(error);
    };
    
    speechSynthesis.speak(utterance);
  });
}

// Handle quick text
async function handleQuickText() {
  const text = elements.quickText.value.trim();
  if (!text) return;
  
  addToConversationHistory('You', text);
  elements.quickText.value = '';
  
  try {
    updateVoiceStatus(' Agent is thinking...', 'speaking');
    const aiResponse = await getAIResponse(text);
    
    addToConversationHistory('Agent', aiResponse);
    
    // Speak response
    updateVoiceStatus(' Agent is speaking...', 'speaking');
    await speak(aiResponse);
    
    updateVoiceStatus(' Agent finished speaking. Your turn!');
    
  } catch (error) {
    updateVoiceStatus(' Error: ' + error.message);
  }
}

// Add to conversation history
function addToConversationHistory(speaker, message) {
  conversationHistory.push({ speaker, message, timestamp: new Date() });
  updateConversationDisplay();
}

// Update conversation display
function updateConversationDisplay() {
  const last4 = conversationHistory.slice(-4);
  elements.conversationHistory.innerHTML = '';
  
  if (last4.length === 0) {
    elements.conversationHistory.innerHTML = '<div class="loading">Conversation will appear here...</div>';
    return;
  }
  
  last4.forEach(item => {
    const div = document.createElement('div');
    div.className = `history-item ${item.speaker.toLowerCase()}`;
    
    // Format message for display (clean for conversation history)
    const cleanMessage = item.message
      .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
      .replace(/`([^`]*)`/g, '$1')  // Remove inline code
      .replace(/#{1,6}\s/g, '')  // Remove headers
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .trim();
    
    div.innerHTML = `<strong>${item.speaker === 'You' ? '👤' : '🤖'} ${item.speaker}:</strong> ${cleanMessage}`;
    elements.conversationHistory.appendChild(div);
  });
  
  elements.conversationHistory.scrollTop = elements.conversationHistory.scrollHeight;
}

// Update voice status
function updateVoiceStatus(message, className = '') {
  elements.voiceStatus.innerHTML = message;
  elements.voiceStatus.className = `voice-status ${className}`;
}

// Show error
function showError(message) {
  // Create or update error display
  let errorDiv = document.getElementById('errorDisplay');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'errorDisplay';
    errorDiv.className = 'error';
    elements.responseContainer.parentNode.insertBefore(errorDiv, elements.responseContainer);
  }
  
  errorDiv.innerHTML = '❌ ' + message;
  errorDiv.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Load voices when available
speechSynthesis.addEventListener('voiceschanged', () => {
  console.log('Voices loaded:', speechSynthesis.getVoices().length);
});