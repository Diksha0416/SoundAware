import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  t: (key: string, options?: any) => string;
  availableLanguages: { code: string; name: string; nativeName: string }[];
  translateText: (text: string, targetLanguage: string) => Promise<string>;
}

const translations = {
  en: {
    // App Name
    appName: 'SoundAware',
    
    // Navigation
    home: 'Home',
    record: 'Record',
    history: 'History',
    notifications: 'Alerts',
    chatbot: 'AI Chat',
    settings: 'Settings',
    
    // Home Screen
    homeTitle: 'Sound Monitor',
    homeSubtitle: 'ML-powered household sound detection',
    activelyMonitoring: 'Actively Monitoring',
    monitoringPaused: 'Monitoring Paused',
    today: 'Today',
    accuracy: 'Accuracy',
    total: 'Total',
    quickActions: 'Quick Actions',
    startRecording: 'Start Recording',
    viewAlerts: 'View Alerts',
    recentDetections: 'Recent Detections',
    noDetectionsYet: 'No detections yet. Start recording to see results!',
    
    // Record Screen
    recordTitle: 'Audio Capture Center',
    recordSubtitle: 'Record audio to classify household sounds',
    tapToStart: 'Tap to start recording',
    recording: 'Recording...',
    processing: 'Processing...',
    lastDetection: 'Last Detection',
    uploadAudioFile: 'Upload Audio File',
    analyzePreRecorded: 'Analyze pre-recorded audio files',
    chooseFile: 'Choose File',
    audioControls: 'Audio Controls',
    playLast: 'Play Last',
    pause: 'Pause',
    
    // History Screen
    historyTitle: 'Detection History',
    totalDetections: 'total detections',
    exportCsv: 'Export CSV',
    share: 'Share',
    clearHistory: 'Clear History',
    showStatistics: 'Show Statistics',
    hideStatistics: 'Hide Statistics',
    detectionStatistics: 'Detection Statistics',
    avgConfidence: 'Avg Confidence',
    mostCommon: 'Most Common',
    
    // Notifications
    notificationsTitle: 'Notifications',
    unreadNotifications: 'unread notifications',
    clearAll: 'Clear All',
    noNotifications: 'No Notifications',
    seeAlertsHere: 'You\'ll see alerts and updates here',
    
  // Settings
  settingsTitle: 'Settings',
  customizeExperience: 'Where your choices shape your smart home',
    appearance: 'Appearance',
    darkMode: 'Dark Mode',
    toggleThemes: 'Toggle between light and dark themes',
    audioDetection: 'Audio & Detection',
    autoRecording: 'Auto Recording',
    autoStart: 'Automatically start recording on app launch',
    sensitivity: 'Sensitivity',
    detectionLevel: 'Detection sensitivity level',
    pushNotifications: 'Push Notifications',
    receiveAlerts: 'Receive alerts for important sounds',
    language: 'Language',
    selectLanguage: 'Select your preferred language',
    mlModel: 'ML Model Configuration',
    modelSettings: 'Model Settings',
    confidenceThreshold: 'Confidence Threshold',
    minimumConfidence: 'Minimum confidence for valid detections',
    preprocessing: 'Audio Preprocessing',
    enablePreprocessing: 'Enable audio preprocessing for better accuracy',
    postprocessing: 'Result Postprocessing',
    enablePostprocessing: 'Enable result postprocessing and filtering',
    advancedSettings: 'Advanced Settings',
    showAdvanced: 'Show Advanced',
    hideAdvanced: 'Hide Advanced',
    batchSize: 'Batch Size',
    processingBatch: 'Audio processing batch size',
    maxDuration: 'Max Duration',
    maximumAudio: 'Maximum audio duration (seconds)',
    sampleRate: 'Sample Rate',
    audioSample: 'Audio sample rate (Hz)',
    aboutSupport: 'About & Support',
    version: 'Version',
    privacy: 'Privacy',
    allLocal: 'All processing is local',
    platform: 'Platform',
    resetSettings: 'Reset Settings',
    getHelp: 'Get Help',
    resetMLModel: 'Reset ML Model',
    resetMLModelDesc: 'Reset all ML model settings to defaults',
  viewDetails: 'Details',
    
  // AI Chat
  aiAssistant: 'AI Assistant',
  askAboutSound: 'Your home’s drama analyst — powered by AI',
    aiTyping: 'AI is typing...',
    askAnything: 'Ask me anything...',
    voiceAssistant: 'Voice Assistant',
    tapToSpeak: 'Tap to speak',
    listening: 'Listening...',
    voiceProcessing: 'Processing voice...',
    
    // Common
    all: 'All',
    none: 'None',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    reset: 'Reset',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    
    // Export/Share
    exportSuccess: 'Export Successful',
    exportFailed: 'Export Failed',
    shareSuccess: 'Share Prepared',
    shareFailed: 'Share Failed',
    csvExported: 'CSV file exported successfully',
    summaryShared: 'Detection summary prepared for sharing',
  },
  
  hi: {
    // App Name
    appName: 'SoundAware',
    
    // Navigation
    home: 'होम',
    record: 'रिकॉर्ड',
    history: 'इतिहास',
    notifications: 'अलर्ट',
    chatbot: 'AI चैट',
    settings: 'सेटिंग्स',
    
    // Home Screen
    homeTitle: 'ध्वनि मॉनिटर',
    homeSubtitle: 'AI-संचालित घरेलू ध्वनि पहचान',
    activelyMonitoring: 'सक्रिय निगरानी',
    monitoringPaused: 'निगरानी रुकी हुई',
    today: 'आज',
    accuracy: 'सटीकता',
    total: 'कुल',
    quickActions: 'त्वरित कार्य',
    startRecording: 'रिकॉर्डिंग शुरू करें',
    viewAlerts: 'अलर्ट देखें',
    recentDetections: 'हाल की पहचान',
    noDetectionsYet: 'अभी तक कोई पहचान नहीं। परिणाम देखने के लिए रिकॉर्डिंग शुरू करें!',
    
    // Record Screen
    recordTitle: 'ध्वनि रिकॉर्डिंग',
    recordSubtitle: 'घरेलू ध्वनियों को वर्गीकृत करने के लिए ऑडियो रिकॉर्ड करें',
    tapToStart: 'रिकॉर्डिंग शुरू करने के लिए टैप करें',
    recording: 'रिकॉर्ड हो रहा है...',
    processing: 'प्रसंस्करण...',
    lastDetection: 'अंतिम पहचान',
    uploadAudioFile: 'ऑडियो फ़ाइल अपलोड करें',
    analyzePreRecorded: 'पूर्व-रिकॉर्ड की गई ऑडियो फ़ाइलों का विश्लेषण करें',
    chooseFile: 'फ़ाइल चुनें',
    audioControls: 'ऑडियो नियंत्रण',
    playLast: 'अंतिम चलाएं',
    pause: 'रोकें',
    
    // History Screen
    historyTitle: 'पहचान इतिहास',
    totalDetections: 'कुल पहचान',
    exportCsv: 'CSV निर्यात करें',
    share: 'साझा करें',
    clearHistory: 'इतिहास साफ़ करें',
    showStatistics: 'आंकड़े दिखाएं',
    hideStatistics: 'आंकड़े छुपाएं',
    detectionStatistics: 'पहचान आंकड़े',
    avgConfidence: 'औसत विश्वास',
    mostCommon: 'सबसे आम',
    
    // Notifications
    notificationsTitle: 'सूचनाएं',
    unreadNotifications: 'अपठित सूचनाएं',
    clearAll: 'सभी साफ़ करें',
    noNotifications: 'कोई सूचना नहीं',
    seeAlertsHere: 'आपको यहाँ अलर्ट और अपडेट दिखेंगे',
    
    // Settings
    settingsTitle: 'सेटिंग्स',
    customizeExperience: 'अपने ध्वनि पहचान अनुभव को अनुकूलित करें',
    appearance: 'दिखावट',
    darkMode: 'डार्क मोड',
    toggleThemes: 'हल्के और गहरे थीम के बीच टॉगल करें',
    audioDetection: 'ऑडियो और पहचान',
    autoRecording: 'स्वचालित रिकॉर्डिंग',
    autoStart: 'ऐप लॉन्च पर स्वचालित रूप से रिकॉर्डिंग शुरू करें',
    sensitivity: 'संवेदनशीलता',
    detectionLevel: 'पहचान संवेदनशीलता स्तर',
    pushNotifications: 'पुश सूचनाएं',
    receiveAlerts: 'महत्वपूर्ण ध्वनियों के लिए अलर्ट प्राप्त करें',
    language: 'भाषा',
    selectLanguage: 'अपनी पसंदीदा भाषा चुनें',
    mlModel: 'ML मॉडल कॉन्फ़िगरेशन',
    modelSettings: 'मॉडल सेटिंग्स',
    confidenceThreshold: 'विश्वास सीमा',
    minimumConfidence: 'वैध पहचान के लिए न्यूनतम विश्वास',
    preprocessing: 'ऑडियो प्रीप्रोसेसिंग',
    enablePreprocessing: 'बेहतर सटीकता के लिए ऑडियो प्रीप्रोसेसिंग सक्षम करें',
    postprocessing: 'परिणाम पोस्टप्रोसेसिंग',
    enablePostprocessing: 'परिणाम पोस्टप्रोसेसिंग और फ़िल्टरिंग सक्षम करें',
    advancedSettings: 'उन्नत सेटिंग्स',
    showAdvanced: 'उन्नत दिखाएं',
    hideAdvanced: 'उन्नत छुपाएं',
    batchSize: 'बैच साइज़',
    processingBatch: 'ऑडियो प्रसंस्करण बैच साइज़',
    maxDuration: 'अधिकतम अवधि',
    maximumAudio: 'अधिकतम ऑडियो अवधि (सेकंड)',
    sampleRate: 'नमूना दर',
    audioSample: 'ऑडियो नमूना दर (Hz)',
    aboutSupport: 'के बारे में और सहायता',
    version: 'संस्करण',
    privacy: 'गोपनीयता',
    allLocal: 'सभी प्रसंस्करण स्थानीय है',
    platform: 'प्लेटफॉर्म',
    resetSettings: 'सेटिंग्स रीसेट करें',
    getHelp: 'सहायता प्राप्त करें',
    resetMLModel: 'ML मॉडल रीसेट करें',
  viewDetails: 'विवरण',
    
    // AI Chat
    aiAssistant: 'AI सहायक',
  askAboutSound: 'आपके घर का ड्रामा विश्लेषक — AI द्वारा संचालित',
    aiTyping: 'AI टाइप कर रहा है...',
    askAnything: 'मुझसे कुछ भी पूछें...',
    
    // Common
    all: 'सभी',
    none: 'कोई नहीं',
    yes: 'हाँ',
    no: 'नहीं',
    ok: 'ठीक',
    cancel: 'रद्द करें',
    confirm: 'पुष्टि करें',
    save: 'सेव करें',
    reset: 'रीसेट करें',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    close: 'बंद करें',
    
    // Export/Share
    exportSuccess: 'निर्यात सफल',
    exportFailed: 'निर्यात असफल',
    shareSuccess: 'साझाकरण तैयार',
    shareFailed: 'साझाकरण असफल',
    csvExported: 'CSV फ़ाइल सफलतापूर्वक निर्यात की गई',
    summaryShared: 'पहचान सारांश साझाकरण के लिए तैयार',
  },

  pa: {
    // App Name
    appName: 'SoundAware',
    
    // Navigation
    home: 'ਘਰ',
    record: 'ਰਿਕਾਰਡ',
    history: 'ਇਤਿਹਾਸ',
    notifications: 'ਅਲਰਟ',
    chatbot: 'AI ਚੈਟ',
    settings: 'ਸੈਟਿੰਗਜ਼',
    
    // Home Screen
    homeTitle: 'ਆਵਾਜ਼ ਮਾਨੀਟਰ',
    homeSubtitle: 'AI-ਸੰਚਾਲਿਤ ਘਰੇਲੂ ਆਵਾਜ਼ ਪਛਾਣ',
    activelyMonitoring: 'ਸਰਗਰਮ ਨਿਗਰਾਨੀ',
    monitoringPaused: 'ਨਿਗਰਾਨੀ ਰੁਕੀ ਹੋਈ',
    today: 'ਅੱਜ',
    accuracy: 'ਸ਼ੁੱਧਤਾ',
    total: 'ਕੁੱਲ',
    quickActions: 'ਤੇਜ਼ ਕਾਰਵਾਈਆਂ',
    startRecording: 'ਰਿਕਾਰਡਿੰਗ ਸ਼ੁਰੂ ਕਰੋ',
    viewAlerts: 'ਅਲਰਟ ਦੇਖੋ',
    recentDetections: 'ਹਾਲ ਦੀਆਂ ਪਛਾਣਾਂ',
    noDetectionsYet: 'ਅਜੇ ਤੱਕ ਕੋਈ ਪਛਾਣ ਨਹੀਂ। ਨਤੀਜੇ ਦੇਖਣ ਲਈ ਰਿਕਾਰਡਿੰਗ ਸ਼ੁਰੂ ਕਰੋ!',
    
    // Record Screen
    recordTitle: 'ਆਵਾਜ਼ ਰਿਕਾਰਡਿੰਗ',
    recordSubtitle: 'ਘਰੇਲੂ ਆਵਾਜ਼ਾਂ ਨੂੰ ਵਰਗੀਕਰਨ ਲਈ ਆਡੀਓ ਰਿਕਾਰਡ ਕਰੋ',
    tapToStart: 'ਰਿਕਾਰਡਿੰਗ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਟੈਪ ਕਰੋ',
    recording: 'ਰਿਕਾਰਡ ਹੋ ਰਿਹਾ ਹੈ...',
    processing: 'ਪ੍ਰਕਿਰਿਆ...',
    lastDetection: 'ਆਖਰੀ ਪਛਾਣ',
    uploadAudioFile: 'ਆਡੀਓ ਫਾਈਲ ਅਪਲੋਡ ਕਰੋ',
    analyzePreRecorded: 'ਪਹਿਲਾਂ ਰਿਕਾਰਡ ਕੀਤੀਆਂ ਆਡੀਓ ਫਾਈਲਾਂ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੋ',
    chooseFile: 'ਫਾਈਲ ਚੁਣੋ',
    audioControls: 'ਆਡੀਓ ਕੰਟਰੋਲ',
    playLast: 'ਆਖਰੀ ਚਲਾਓ',
    pause: 'ਰੋਕੋ',
    
    // History Screen
    historyTitle: 'ਪਛਾਣ ਇਤਿਹਾਸ',
    totalDetections: 'ਕੁੱਲ ਪਛਾਣਾਂ',
    exportCsv: 'CSV ਨਿਰਯਾਤ ਕਰੋ',
    share: 'ਸਾਂਝਾ ਕਰੋ',
    clearHistory: 'ਇਤਿਹਾਸ ਸਾਫ਼ ਕਰੋ',
    showStatistics: 'ਅੰਕੜੇ ਦਿਖਾਓ',
    hideStatistics: 'ਅੰਕੜੇ ਲੁਕਾਓ',
    detectionStatistics: 'ਪਛਾਣ ਅੰਕੜੇ',
    avgConfidence: 'ਔਸਤ ਭਰੋਸਾ',
    mostCommon: 'ਸਭ ਤੋਂ ਆਮ',
    
    // Notifications
    notificationsTitle: 'ਸੂਚਨਾਵਾਂ',
    unreadNotifications: 'ਨਾ ਪੜ੍ਹੀਆਂ ਸੂਚਨਾਵਾਂ',
    clearAll: 'ਸਭ ਸਾਫ਼ ਕਰੋ',
    noNotifications: 'ਕੋਈ ਸੂਚਨਾ ਨਹੀਂ',
    seeAlertsHere: 'ਤੁਸੀਂ ਇੱਥੇ ਅਲਰਟ ਅਤੇ ਅਪਡੇਟ ਦੇਖੋਗੇ',
    
    // Settings
    settingsTitle: 'ਸੈਟਿੰਗਜ਼',
    customizeExperience: 'ਆਪਣੇ ਆਵਾਜ਼ ਪਛਾਣ ਅਨੁਭਵ ਨੂੰ ਅਨੁਕੂਲਿਤ ਕਰੋ',
    appearance: 'ਦਿੱਖ',
    darkMode: 'ਡਾਰਕ ਮੋਡ',
    toggleThemes: 'ਹਲਕੇ ਅਤੇ ਗੂੜ੍ਹੇ ਥੀਮ ਵਿਚਕਾਰ ਟੌਗਲ ਕਰੋ',
    audioDetection: 'ਆਡੀਓ ਅਤੇ ਪਛਾਣ',
    autoRecording: 'ਆਟੋ ਰਿਕਾਰਡਿੰਗ',
    autoStart: 'ਐਪ ਲਾਂਚ ਤੇ ਆਪਣੇ ਆਪ ਰਿਕਾਰਡਿੰਗ ਸ਼ੁਰੂ ਕਰੋ',
    sensitivity: 'ਸੰਵੇਦਨਸ਼ੀਲਤਾ',
    detectionLevel: 'ਪਛਾਣ ਸੰਵੇਦਨਸ਼ੀਲਤਾ ਪੱਧਰ',
    pushNotifications: 'ਪੁਸ਼ ਸੂਚਨਾਵਾਂ',
    receiveAlerts: 'ਮਹੱਤਵਪੂਰਨ ਆਵਾਜ਼ਾਂ ਲਈ ਅਲਰਟ ਪ੍ਰਾਪਤ ਕਰੋ',
    language: 'ਭਾਸ਼ਾ',
    selectLanguage: 'ਆਪਣੀ ਪਸੰਦੀਦਾ ਭਾਸ਼ਾ ਚੁਣੋ',
    mlModel: 'ML ਮਾਡਲ ਸੰਰਚਨਾ',
    modelSettings: 'ਮਾਡਲ ਸੈਟਿੰਗਜ਼',
    confidenceThreshold: 'ਭਰੋਸਾ ਸੀਮਾ',
    minimumConfidence: 'ਵੈਧ ਪਛਾਣਾਂ ਲਈ ਘੱਟੋ-ਘੱਟ ਭਰੋਸਾ',
    preprocessing: 'ਆਡੀਓ ਪ੍ਰੀਪ੍ਰੋਸੈਸਿੰਗ',
    enablePreprocessing: 'ਬਿਹਤਰ ਸ਼ੁੱਧਤਾ ਲਈ ਆਡੀਓ ਪ੍ਰੀਪ੍ਰੋਸੈਸਿੰਗ ਸਮਰੱਥ ਕਰੋ',
    postprocessing: 'ਨਤੀਜਾ ਪੋਸਟਪ੍ਰੋਸੈਸਿੰਗ',
    enablePostprocessing: 'ਨਤੀਜਾ ਪੋਸਟਪ੍ਰੋਸੈਸਿੰਗ ਅਤੇ ਫਿਲਟਰਿੰਗ ਸਮਰੱਥ ਕਰੋ',
    advancedSettings: 'ਉੱਨਤ ਸੈਟਿੰਗਜ਼',
    showAdvanced: 'ਉੱਨਤ ਦਿਖਾਓ',
    hideAdvanced: 'ਉੱਨਤ ਲੁਕਾਓ',
    batchSize: 'ਬੈਚ ਸਾਈਜ਼',
    processingBatch: 'ਆਡੀਓ ਪ੍ਰੋਸੈਸਿੰਗ ਬੈਚ ਸਾਈਜ਼',
    maxDuration: 'ਅਧਿਕਤਮ ਮਿਆਦ',
    maximumAudio: 'ਅਧਿਕਤਮ ਆਡੀਓ ਮਿਆਦ (ਸਕਿੰਟ)',
    sampleRate: 'ਨਮੂਨਾ ਦਰ',
    audioSample: 'ਆਡੀਓ ਨਮੂਨਾ ਦਰ (Hz)',
    aboutSupport: 'ਬਾਰੇ ਅਤੇ ਸਹਾਇਤਾ',
    version: 'ਸੰਸਕਰਣ',
    privacy: 'ਗੁਪਤਤਾ',
    allLocal: 'ਸਾਰੀ ਪ੍ਰਕਿਰਿਆ ਸਥਾਨਕ ਹੈ',
    platform: 'ਪਲੇਟਫਾਰਮ',
    resetSettings: 'ਸੈਟਿੰਗਜ਼ ਰੀਸੈਟ ਕਰੋ',
    getHelp: 'ਮਦਦ ਲਓ',
    
    // AI Chat
    aiAssistant: 'AI ਸਹਾਇਕ',
  askAboutSound: 'ਤੁਹਾਡੇ ਘਰ ਦਾ ਡਰਾਮਾ ਵਿਸ਼ਲੇਸ਼ਕ — AI ਨਾਲ ਚਲਾਇਆ ਗਿਆ',
    aiTyping: 'AI ਟਾਈਪ ਕਰ ਰਿਹਾ ਹੈ...',
    askAnything: 'ਮੈਨੂੰ ਕੁਝ ਵੀ ਪੁੱਛੋ...',
    
    // Common
    all: 'ਸਭ',
    none: 'ਕੋਈ ਨਹੀਂ',
    yes: 'ਹਾਂ',
    no: 'ਨਹੀਂ',
    ok: 'ਠੀਕ ਹੈ',
    cancel: 'ਰੱਦ ਕਰੋ',
    confirm: 'ਪੁਸ਼ਟੀ ਕਰੋ',
    save: 'ਸੇਵ ਕਰੋ',
    reset: 'ਰੀਸੈਟ ਕਰੋ',
    delete: 'ਮਿਟਾਓ',
    edit: 'ਸੰਪਾਦਿਤ ਕਰੋ',
    close: 'ਬੰਦ ਕਰੋ',
    
    // Export/Share
    exportSuccess: 'ਨਿਰਯਾਤ ਸਫਲ',
    exportFailed: 'ਨਿਰਯਾਤ ਅਸਫਲ',
    shareSuccess: 'ਸਾਂਝਾਕਰਨ ਤਿਆਰ',
    shareFailed: 'ਸਾਂਝਾਕਰਨ ਅਸਫਲ',
    csvExported: 'CSV ਫਾਈਲ ਸਫਲਤਾਪੂਰਵਕ ਨਿਰਯਾਤ ਕੀਤੀ ਗਈ',
    summaryShared: 'ਪਛਾਣ ਸਾਰਾਂਸ਼ ਸਾਂਝਾਕਰਨ ਲਈ ਤਿਆਰ',
  },

  gu: {
    // App Name
    appName: 'SoundAware',
    
    // Navigation
    home: 'ઘર',
    record: 'રેકોર્ડ',
    history: 'ઇતિહાસ',
    notifications: 'અલર્ટ',
    chatbot: 'AI ચેટ',
    settings: 'સેટિંગ્સ',
    
    // Home Screen
    homeTitle: 'અવાજ મોનિટર',
    homeSubtitle: 'AI-સંચાલિત ઘરેલું અવાજ ઓળખ',
    activelyMonitoring: 'સક્રિય નિરીક્ષણ',
    monitoringPaused: 'નિરીક્ષણ અટકાવ્યું',
    today: 'આજે',
    accuracy: 'ચોકસાઈ',
    total: 'કુલ',
    quickActions: 'ઝડપી ક્રિયાઓ',
    startRecording: 'રેકોર્ડિંગ શરૂ કરો',
    viewAlerts: 'અલર્ટ જુઓ',
    recentDetections: 'તાજેતરની ઓળખ',
    noDetectionsYet: 'હજુ સુધી કોઈ ઓળખ નથી. પરિણામો જોવા માટે રેકોર્ડિંગ શરૂ કરો!',
    
    // Record Screen
    recordTitle: 'અવાજ રેકોર્ડિંગ',
    recordSubtitle: 'ઘરેલા અવાજોને વર્ગીકૃત કરવા માટે ઓડિયો રેકોર્ડ કરો',
    tapToStart: 'રેકોર્ડિંગ શરૂ કરવા માટે ટેપ કરો',
    recording: 'રેકોર્ડ થઈ રહ્યું છે...',
    processing: 'પ્રક્રિયા...',
    lastDetection: 'છેલ્લી ઓળખ',
    uploadAudioFile: 'ઓડિયો ફાઇલ અપલોડ કરો',
    analyzePreRecorded: 'પૂર્વ-રેકોર્ડ કરેલી ઓડિયો ફાઇલોનું વિશ્લેષણ કરો',
    chooseFile: 'ફાઇલ પસંદ કરો',
    audioControls: 'ઓડિયો નિયંત્રણો',
    playLast: 'છેલ્લું ચલાવો',
    pause: 'થોભાવો',
    
    // History Screen
    historyTitle: 'ઓળખ ઇતિહાસ',
    totalDetections: 'કુલ ઓળખ',
    exportCsv: 'CSV નિકાસ કરો',
    share: 'શેર કરો',
    clearHistory: 'ઇતિહાસ સાફ કરો',
    showStatistics: 'આંકડા બતાવો',
    hideStatistics: 'આંકડા છુપાવો',
    detectionStatistics: 'ઓળખ આંકડા',
    avgConfidence: 'સરેરાશ વિશ્વાસ',
    mostCommon: 'સૌથી સામાન્ય',
    
    // Settings
    settingsTitle: 'સેટિંગ્સ',
    customizeExperience: 'તમારા અવાજ ઓળખ અનુભવને કસ્ટમાઇઝ કરો',
    appearance: 'દેખાવ',
    darkMode: 'ડાર્ક મોડ',
    toggleThemes: 'હલકા અને ઘાટા થીમ વચ્ચે ટોગલ કરો',
    language: 'ભાષા',
    selectLanguage: 'તમારી પસંદગીની ભાષા પસંદ કરો',
    resetSettings: 'સેટિંગ્સ રીસેટ કરો',
    getHelp: 'મદદ મેળવો',
    
    // Common
    all: 'બધું',
    none: 'કંઈ નહીં',
    yes: 'હા',
    no: 'ના',
    ok: 'ઓકે',
    cancel: 'રદ કરો',
    confirm: 'પુષ્ટિ કરો',
    save: 'સેવ કરો',
    reset: 'રીસેટ કરો',
    delete: 'ડિલીટ કરો',
    edit: 'સંપાદિત કરો',
    close: 'બંધ કરો',
    
    // Export/Share
    exportSuccess: 'નિકાસ સફળ',
    exportFailed: 'નિકાસ અસફળ',
    shareSuccess: 'શેરિંગ તૈયાર',
    shareFailed: 'શેરિંગ અસફળ',
    csvExported: 'CSV ફાઇલ સફળતાપૂર્વક નિકાસ કરવામાં આવી',
    summaryShared: 'ઓળખ સારાંશ શેરિંગ માટે તૈયાર',
  },

  ta: {
    // App Name
    appName: 'SoundAware',
    
    // Navigation
    home: 'வீடு',
    record: 'பதிவு',
    history: 'வரலாறு',
    notifications: 'எச்சரிக்கைகள்',
    chatbot: 'AI அரட்டை',
    settings: 'அமைப்புகள்',
    
    // Home Screen
    homeTitle: 'ஒலி கண்காணிப்பு',
    homeSubtitle: 'AI-இயங்கும் வீட்டு ஒலி அடையாளம்',
    activelyMonitoring: 'செயலில் கண்காணிப்பு',
    monitoringPaused: 'கண்காணிப்பு நிறுத்தப்பட்டது',
    today: 'இன்று',
    accuracy: 'துல்லியம்',
    total: 'மொத்தம்',
    quickActions: 'விரைவு செயல்கள்',
    startRecording: 'பதிவு தொடங்கு',
    viewAlerts: 'எச்சரிக்கைகளைப் பார்க்கவும்',
    recentDetections: 'சமீபத்திய கண்டறிதல்கள்',
    noDetectionsYet: 'இன்னும் கண்டறிதல்கள் இல்லை. முடிவுகளைப் பார்க்க பதிவைத் தொடங்கவும்!',
    
    // Record Screen
    recordTitle: 'ஒலி பதிவு',
    recordSubtitle: 'வீட்டு ஒலிகளை வகைப்படுத்த ஆடியோவைப் பதிவு செய்யவும்',
    tapToStart: 'பதிவைத் தொடங்க தட்டவும்',
    recording: 'பதிவு செய்யப்படுகிறது...',
    processing: 'செயலாக்கம்...',
    lastDetection: 'கடைசி கண்டறிதல்',
    uploadAudioFile: 'ஆடியோ கோப்பை பதிவேற்றவும்',
    analyzePreRecorded: 'முன்பே பதிவு செய்யப்பட்ட ஆடியோ கோப்புகளை பகுப்பாய்வு செய்யவும்',
    chooseFile: 'கோப்பைத் தேர்ந்தெடுக்கவும்',
    audioControls: 'ஆடியோ கட்டுப்பாடுகள்',
    playLast: 'கடைசியாக இயக்கவும்',
    pause: 'இடைநிறுத்தம்',
    
    // History Screen
    historyTitle: 'கண்டறிதல் வரலாறு',
    totalDetections: 'மொத்த கண்டறிதல்கள்',
    exportCsv: 'CSV ஏற்றுமதி',
    share: 'பகிர்',
    clearHistory: 'வரலாற்றை அழிக்கவும்',
    showStatistics: 'புள்ளிவிவரங்களைக் காட்டு',
    hideStatistics: 'புள்ளிவிவரங்களை மறைக்கவும்',
    detectionStatistics: 'கண்டறிதல் புள்ளிவிவரங்கள்',
    avgConfidence: 'சராசரி நம்பிக்கை',
    mostCommon: 'மிகவும் பொதுவான',
    
    // Settings
    settingsTitle: 'அமைப்புகள்',
    customizeExperience: 'உங்கள் ஒலி கண்டறிதல் அனுபவத்தை தனிப்பயனாக்கவும்',
    appearance: 'தோற்றம்',
    darkMode: 'இருண்ட பயன்முறை',
    toggleThemes: 'வெளிச்சம் மற்றும் இருண்ட தீம்களுக்கு இடையில் மாற்றவும்',
    language: 'மொழி',
    selectLanguage: 'உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்',
    resetSettings: 'அமைப்புகளை மீட்டமைக்கவும்',
    getHelp: 'உதவி பெறுங்கள்',
    
    // Common
    all: 'அனைத்தும்',
    none: 'எதுவுமில்லை',
    yes: 'ஆம்',
    no: 'இல்லை',
    ok: 'சரி',
    cancel: 'ரத்து செய்',
    confirm: 'உறுதிப்படுத்து',
    save: 'சேமி',
    reset: 'மீட்டமை',
    delete: 'நீக்கு',
    edit: 'திருத்து',
    close: 'மூடு',
    
    // Export/Share
    exportSuccess: 'ஏற்றுமதி வெற்றிகரமானது',
    exportFailed: 'ஏற்றுமதி தோல்வியுற்றது',
    shareSuccess: 'பகிர்வு தயார்',
    shareFailed: 'பகிர்வு தோல்வியுற்றது',
    csvExported: 'CSV கோப்பு வெற்றிகரமாக ஏற்றுமதி செய்யப்பட்டது',
    summaryShared: 'கண்டறிதல் சுருக்கம் பகிர்வுக்கு தயார்',
  },

  te: {
    // App Name
    appName: 'SoundAware',
    
    // Navigation
    home: 'ఇల్లు',
    record: 'రికార్డ్',
    history: 'చరిత్ర',
    notifications: 'హెచ్చరికలు',
    chatbot: 'AI చాట్',
    settings: 'సెట్టింగులు',
    
    // Home Screen
    homeTitle: 'ధ్వని పర్యవేక్షణ',
    homeSubtitle: 'AI-నడిచే గృహ ధ్వని గుర్తింపు',
    activelyMonitoring: 'చురుకుగా పర్యవేక్షణ',
    monitoringPaused: 'పర్యవేక్షణ నిలిపివేయబడింది',
    today: 'ఈరోజు',
    accuracy: 'ఖచ్చితత్వం',
    total: 'మొత్తం',
    quickActions: 'త్వరిత చర్యలు',
    startRecording: 'రికార్డింగ్ ప్రారంభించు',
    viewAlerts: 'హెచ్చరికలను చూడండి',
    recentDetections: 'ఇటీవలి గుర్తింపులు',
    noDetectionsYet: 'ఇంకా గుర్తింపులు లేవు. ఫలితాలను చూడటానికి రికార్డింగ్ ప్రారంభించండి!',
    
    // Record Screen
    recordTitle: 'ధ్వని రికార్డింగ్',
    recordSubtitle: 'గృహ ధ్వనులను వర్గీకరించడానికి ఆడియోను రికార్డ్ చేయండి',
    tapToStart: 'రికార్డింగ్ ప్రారంభించడానికి ట్యాప్ చేయండి',
    recording: 'రికార్డ్ అవుతోంది...',
    processing: 'ప్రాసెసింగ్...',
    lastDetection: 'చివరి గుర్తింపు',
    uploadAudioFile: 'ఆడియో ఫైల్ అప్‌లోడ్ చేయండి',
    analyzePreRecorded: 'ముందుగా రికార్డ్ చేసిన ఆడియో ఫైల్‌లను విశ్లేషించండి',
    chooseFile: 'ఫైల్ ఎంచుకోండి',
    audioControls: 'ఆడియో నియంత్రణలు',
    playLast: 'చివరిది ప్లే చేయండి',
    pause: 'పాజ్',
    
    // History Screen
    historyTitle: 'గుర్తింపు చరిత్ర',
    totalDetections: 'మొత్తం గుర్తింపులు',
    exportCsv: 'CSV ఎగుమతి',
    share: 'భాగస్వామ్యం',
    clearHistory: 'చరిత్రను క్లియర్ చేయండి',
    showStatistics: 'గణాంకాలను చూపించు',
    hideStatistics: 'గణాంకాలను దాచు',
    detectionStatistics: 'గుర్తింపు గణాంకాలు',
    avgConfidence: 'సగటు విశ్వాసం',
    mostCommon: 'అత్యంత సాధారణ',
    
    // Settings
    settingsTitle: 'సెట్టింగులు',
    customizeExperience: 'మీ ధ్వని గుర్తింపు అనుభవాన్ని అనుకూలీకరించండి',
    appearance: 'రూపం',
    darkMode: 'డార్క్ మోడ్',
    toggleThemes: 'లేత మరియు ముదురు థీమ్‌ల మధ్య టోగుల్ చేయండి',
    language: 'భాష',
    selectLanguage: 'మీ ఇష్టమైన భాషను ఎంచుకోండి',
    resetSettings: 'సెట్టింగులను రీసెట్ చేయండి',
    getHelp: 'సహాయం పొందండి',
    
    // Common
    all: 'అన్నీ',
    none: 'ఏదీ లేదు',
    yes: 'అవును',
    no: 'లేదు',
    ok: 'సరే',
    cancel: 'రద్దు చేయండి',
    confirm: 'నిర్ధారించండి',
    save: 'సేవ్ చేయండి',
    reset: 'రీసెట్ చేయండి',
    delete: 'తొలగించండి',
    edit: 'సవరించండి',
    close: 'మూసివేయండి',
    
    // Export/Share
    exportSuccess: 'ఎగుమతి విజయవంతం',
    exportFailed: 'ఎగుమతి విఫలమైంది',
    shareSuccess: 'భాగస్వామ్యం సిద్ధం',
    shareFailed: 'భాగస్వామ్యం విఫలమైంది',
    csvExported: 'CSV ఫైల్ విజయవంతంగా ఎగుమతి చేయబడింది',
    summaryShared: 'గుర్తింపు సారాంశం భాగస్వామ్యం కోసం సిద్ధం',
  },

  bn: {
    // App Name
    appName: 'SoundAware',
    
    // Navigation
    home: 'বাড়ি',
    record: 'রেকর্ড',
    history: 'ইতিহাস',
    notifications: 'সতর্কতা',
    chatbot: 'AI চ্যাট',
    settings: 'সেটিংস',
    
    // Home Screen
    homeTitle: 'শব্দ মনিটর',
    homeSubtitle: 'AI-চালিত গৃহস্থালী শব্দ সনাক্তকরণ',
    activelyMonitoring: 'সক্রিয়ভাবে পর্যবেক্ষণ',
    monitoringPaused: 'পর্যবেক্ষণ বিরতি',
    today: 'আজ',
    accuracy: 'নির্ভুলতা',
    total: 'মোট',
    quickActions: 'দ্রুত কর্ম',
    startRecording: 'রেকর্ডিং শুরু করুন',
    viewAlerts: 'সতর্কতা দেখুন',
    recentDetections: 'সাম্প্রতিক সনাক্তকরণ',
    noDetectionsYet: 'এখনও কোনো সনাক্তকরণ নেই। ফলাফল দেখতে রেকর্ডিং শুরু করুন!',
    
    // Record Screen
    recordTitle: 'শব্দ রেকর্ডিং',
    recordSubtitle: 'গৃহস্থালী শব্দ শ্রেণীবদ্ধ করতে অডিও রেকর্ড করুন',
    tapToStart: 'রেকর্ডিং শুরু করতে ট্যাপ করুন',
    recording: 'রেকর্ড হচ্ছে...',
    processing: 'প্রক্রিয়াকরণ...',
    lastDetection: 'শেষ সনাক্তকরণ',
    uploadAudioFile: 'অডিও ফাইল আপলোড করুন',
    analyzePreRecorded: 'পূর্ব-রেকর্ড করা অডিও ফাইল বিশ্লেষণ করুন',
    chooseFile: 'ফাইল নির্বাচন করুন',
    audioControls: 'অডিও নিয়ন্ত্রণ',
    playLast: 'শেষটি চালান',
    pause: 'বিরতি',
    
    // History Screen
    historyTitle: 'সনাক্তকরণ ইতিহাস',
    totalDetections: 'মোট সনাক্তকরণ',
    exportCsv: 'CSV রপ্তানি',
    share: 'শেয়ার',
    clearHistory: 'ইতিহাস পরিষ্কার করুন',
    showStatistics: 'পরিসংখ্যান দেখান',
    hideStatistics: 'পরিসংখ্যান লুকান',
    detectionStatistics: 'সনাক্তকরণ পরিসংখ্যান',
    avgConfidence: 'গড় আত্মবিশ্বাস',
    mostCommon: 'সবচেয়ে সাধারণ',
    
    // Settings
    settingsTitle: 'সেটিংস',
    customizeExperience: 'আপনার শব্দ সনাক্তকরণ অভিজ্ঞতা কাস্টমাইজ করুন',
    appearance: 'চেহারা',
    darkMode: 'ডার্ক মোড',
    toggleThemes: 'হালকা এবং গাঢ় থিমের মধ্যে টগল করুন',
    language: 'ভাষা',
    selectLanguage: 'আপনার পছন্দের ভাষা নির্বাচন করুন',
    resetSettings: 'সেটিংস রিসেট করুন',
    getHelp: 'সাহায্য নিন',
    
    // Common
    all: 'সব',
    none: 'কিছুই না',
    yes: 'হ্যাঁ',
    no: 'না',
    cancel: 'বাতিল',
    confirm: 'নিশ্চিত করুন',
    save: 'সেভ করুন',
    reset: 'রিসেট করুন',
    delete: 'মুছে ফেলুন',
    edit: 'সম্পাদনা',
    close: 'বন্ধ',
    
    // Export/Share
    exportSuccess: 'রপ্তানি সফল',
    exportFailed: 'রপ্তানি ব্যর্থ',
    shareSuccess: 'শেয়ারিং প্রস্তুত',
    shareFailed: 'শেয়ারিং ব্যর্থ',
    csvExported: 'CSV ফাইল সফলভাবে রপ্তানি করা হয়েছে',
    summaryShared: 'সনাক্তকরণ সারাংশ শেয়ারিংয়ের জন্য প্রস্তুত',
  },

  mr: {
    // App Name
    appName: 'SoundAware',
    
    // Navigation
    home: 'घर',
    record: 'रेकॉर्ड',
    history: 'इतिहास',
    notifications: 'अलर्ट',
    chatbot: 'AI चॅट',
    settings: 'सेटिंग्ज',
    
    // Home Screen
    homeTitle: 'आवाज मॉनिटर',
    homeSubtitle: 'AI-चालित घरगुती आवाज ओळख',
    activelyMonitoring: 'सक्रिय निरीक्षण',
    monitoringPaused: 'निरीक्षण थांबवले',
    today: 'आज',
    accuracy: 'अचूकता',
    total: 'एकूण',
    quickActions: 'जलद क्रिया',
    startRecording: 'रेकॉर्डिंग सुरू करा',
    viewAlerts: 'अलर्ट पहा',
    recentDetections: 'अलीकडील ओळख',
    noDetectionsYet: 'अजून कोणतीही ओळख नाही. परिणाम पाहण्यासाठी रेकॉर्डिंग सुरू करा!',
    
    // Record Screen
    recordTitle: 'आवाज रेकॉर्डिंग',
    recordSubtitle: 'घरगुती आवाजांचे वर्गीकरण करण्यासाठी ऑडिओ रेकॉर्ड करा',
    tapToStart: 'रेकॉर्डिंग सुरू करण्यासाठी टॅप करा',
    recording: 'रेकॉर्ड होत आहे...',
    processing: 'प्रक्रिया...',
    lastDetection: 'शेवटची ओळख',
    uploadAudioFile: 'ऑडिओ फाइल अपलोड करा',
    analyzePreRecorded: 'पूर्व-रेकॉर्ड केलेल्या ऑडिओ फाइल्सचे विश्लेषण करा',
    chooseFile: 'फाइल निवडा',
    audioControls: 'ऑडिओ नियंत्रणे',
    playLast: 'शेवटचे प्ले करा',
    pause: 'थांबवा',
    
    // History Screen
    historyTitle: 'ओळख इतिहास',
    totalDetections: 'एकूण ओळख',
    exportCsv: 'CSV निर्यात',
    share: 'शेअर',
    clearHistory: 'इतिहास साफ करा',
    showStatistics: 'आकडेवारी दाखवा',
    hideStatistics: 'आकडेवारी लपवा',
    detectionStatistics: 'ओळख आकडेवारी',
    avgConfidence: 'सरासरी आत्मविश्वास',
    mostCommon: 'सर्वात सामान्य',
    
    // Settings
    settingsTitle: 'सेटिंग्ज',
    customizeExperience: 'तुमचा आवाज ओळख अनुभव सानुकूलित करा',
    appearance: 'दिसणे',
    darkMode: 'डार्क मोड',
    toggleThemes: 'हलका आणि गडद थीम दरम्यान टॉगल करा',
    language: 'भाषा',
    selectLanguage: 'तुमची आवडती भाषा निवडा',
    resetSettings: 'सेटिंग्ज रीसेट करा',
    getHelp: 'मदत घ्या',
    
    // Common
    all: 'सर्व',
    none: 'काहीही नाही',
    yes: 'होय',
    no: 'नाही',
    cancel: 'रद्द करा',
    confirm: 'पुष्टी करा',
    save: 'सेव्ह करा',
    reset: 'रीसेट करा',
    delete: 'हटवा',
    edit: 'संपादित करा',
    close: 'बंद करा',
    
    // Export/Share
    exportSuccess: 'निर्यात यशस्वी',
    exportFailed: 'निर्यात अयशस्वी',
    shareSuccess: 'शेअरिंग तयार',
    shareFailed: 'शेअरिंग अयशस्वी',
    csvExported: 'CSV फाइल यशस्वीरित्या निर्यात केली',
    summaryShared: 'ओळख सारांश शेअरिंगसाठी तयार',
  },
};

const i18n = new I18n(translations);

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState('en');

  const availableLanguages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  ];

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem('app_language');
      if (saved) {
        setCurrentLanguage(saved);
        i18n.locale = saved;
      } else {
        const deviceLocale = Localization.getLocales()[0]?.languageTag || 'en';
        const deviceLanguage = deviceLocale.split('-')[0];
        const supportedLanguage = availableLanguages.find(lang => lang.code === deviceLanguage)?.code || 'en';
        setCurrentLanguage(supportedLanguage);
        i18n.locale = supportedLanguage;
      }
    } catch (error) {
      console.log('Error loading language:', error);
    }
  };

  const setLanguage = async (language: string) => {
    setCurrentLanguage(language);
    i18n.locale = language;
    try {
      await AsyncStorage.setItem('app_language', language);
    } catch (error) {
      console.log('Error saving language:', error);
    }
  };

  const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockTranslations: { [key: string]: { [key: string]: string } } = {
        'hi': {
          'Hello': 'नमस्ते',
          'How are you?': 'आप कैसे हैं?',
          'Thank you': 'धन्यवाद',
          'Good morning': 'सुप्रभात',
          'Good evening': 'शुभ संध्या',
        },
        'pa': {
          'Hello': 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',
          'How are you?': 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?',
          'Thank you': 'ਧੰਨਵਾਦ',
        },
        'gu': {
          'Hello': 'નમસ્તે',
          'How are you?': 'તમે કેમ છો?',
          'Thank you': 'આભાર',
        },
      };

      return mockTranslations[targetLanguage]?.[text] || text;
    } catch (error) {
      console.log('Translation error:', error);
      return text;
    }
  };

  const t = (key: string, options?: any) => {
    return i18n.t(key, options);
  };

  return (
    <LanguageContext.Provider value={{
      currentLanguage,
      setLanguage,
      t,
      availableLanguages,
      translateText,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}