import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
// VoiceInput removed per UX request (no microphone in chat input)
import { ChatMessage } from '@/types';
import { Send } from 'lucide-react-native';
import Animated, { FadeInDown, SlideInRight, SlideInLeft } from 'react-native-reanimated';

export default function ChatbotScreen() {
  const { colors } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const { generateResponse, isProcessing } = useAIAssistant();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: currentLanguage === 'hi' 
        ? 'नमस्ते! मैं ध्वनि वर्गीकरण के लिए आपका AI सहायक हूं। ऐप, ध्वनि पहचान, या सुविधाओं के उपयोग के बारे में मुझसे कुछ भी पूछें!'
        : currentLanguage === 'pa'
        ? 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਆਵਾਜ਼ ਵਰਗੀਕਰਨ ਲਈ ਤੁਹਾਡਾ AI ਸਹਾਇਕ ਹਾਂ। ਐਪ, ਆਵਾਜ਼ ਪਛਾਣ, ਜਾਂ ਸੁਵਿਧਾਵਾਂ ਬਾਰੇ ਮੈਨੂੰ ਕੁਝ ਵੀ ਪੁੱਛੋ!'
        : 'Hello! I\'m your advanced AI assistant for sound classification. Ask me anything about the app, sound detection, or how to use the features!',
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const [quickContentWidth, setQuickContentWidth] = useState<number>(0);
  const [quickContainerWidth, setQuickContainerWidth] = useState<number>(0);
  const [quickScrollX, setQuickScrollX] = useState<number>(0);

  // Inject web-only CSS for a visible, themed scrollbar on the quick-questions row.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const styleId = 'chat-quick-scrollbar-style';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    // Use theme color for thumb; fall back to a neutral if not available
    const thumb = (colors && colors.primary) ? colors.primary : '#007AFF';
    const track = (colors && colors.surface) ? colors.surface : '#f0f0f0';
    style.innerHTML = `
      /* quick questions scrollbar */
      #quickQuestionsScroll::-webkit-scrollbar {
        height: 10px;
      }
      #quickQuestionsScroll::-webkit-scrollbar-track {
        background: ${track};
        border-radius: 6px;
      }
      #quickQuestionsScroll::-webkit-scrollbar-thumb {
        background: ${thumb};
        border-radius: 6px;
      }
      /* Firefox */
      #quickQuestionsScroll {
        scrollbar-width: thin;
        scrollbar-color: ${thumb} ${track};
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [colors]);

  const predefinedResponses: { [key: string]: { [key: string]: string } } = {
    en: {
      // Project-focused Q&A (English) — refined per user request
      "how does it work": "SoundAware runs a TensorFlow Lite model locally on-device. The app extracts short audio windows, runs inference, and reports detected sound labels with confidence scores.",
      "what classes": "The app detects 12 target classes (some with speech/no-speech variants) such as applause, dog barking, drill, gunshot, cat meowing, crying, dishes (pot & pan), doorbell, glass breaking, slam, and toilet flush.",
      "how many classes": "There are 12 target classes in the deployed model. Some classes include speech/no-speech variants.",
      // Accuracy Q&A (exact phrasing user asked to add)
      "what is the total accuracy of the model": "The model’s overall accuracy is 71.4%. This is calculated using the total number of correct predictions out of all predictions on the validation/test set.",
      "which class has the highest accuracy": "The best-performing class is applause_no_speech with an accuracy of 97%. This means the model predicts this sound more reliably compared to others.",
      "which class is the most difficult for the model": "The lowest accuracy is seen in dishes_pot_pan_speech with 44% accuracy. This usually happens due to limited training samples or similarity to other sounds.",
      // Interpret confidence: clearer, actionable
      "how do i interpret confidence": "Confidence is the model's estimated probability for a label. Practical guidance: >80% = high confidence, 60–80% = moderate (worth checking), <60% = low (inspect the audio). In Record, view the waveform and play the clip to confirm ambiguous cases.",
      // Help & support: project-relevant steps
      "help and support": "Quick help: 1) Record tab — live detection and file testing (Choose File). 2) History — view past detections and export CSV. 3) Notifications — enable alerts for important sounds. 4) Settings — toggle models, notifications, and language. For model evaluation, see backend/app.py and contexts/model_int8.tflite.",
      "where is data stored": "All audio processing and inference run locally. Detection history is stored in-app; raw audio is not uploaded unless you explicitly export or share it.",
      "export history": "From the History tab you can export detections as CSV or share a summarized report using the system share sheet.",
      "supported formats": "For file-based tests, prefer WAV or M4A. For best results, use PCM/WAV recordings.",
      "test with files": "Go to Record → Choose File to test a pre-recorded audio clip. The app will run the same local inference and display detections.",
      "backend inference": "There's a small Flask backend for evaluation in backend/app.py, but production detection runs on-device using the TFLite model at contexts/model_int8.tflite.",
    },
    hi: {
      // Project-focused Q&A (Hindi)
      "कैसे काम करता है": "SoundAware डिवाइस पर ही TensorFlow Lite मॉडल चलाता है। ऐप छोटे ऑडियो विंडो लेता है, स्थानीय रूप से inference करता है और डिटेक्शन लेबल व confidence दिखाता है।",
      "क्लास कौन-कौन सी हैं": "मॉडल में 12 लक्षित क्लास हैं — जैसे ताली, कुत्ते की भौंक, ड्रिल, गोली, बिल्ली की म्याऊं, रोना, बर्तन, डोरबेल, कांच टूटना, स्लैम, और टॉयलेट फ्लश।",
      "कितनी क्लासेस हैं": "कुल 12 लक्षित क्लास हैं; कुछ क्लास में स्पीच/नो‑स्पीच वेरिएंट शामिल हैं।",
      "मॉडल की सटीकता": "मॉडल की कुल टेस्ट सटीकता लगभग 71.4% है। प्रत्येक क्लास की सटीकता अलग-अलग है — Settings/History में देख सकते हैं।",
      "सबसे अच्छा क्लास": "सबसे अच्छा प्रदर्शन applause_no_speech (~97%) में दिखा।",
      "सबसे कठिन क्लास": "सबसे कम प्रदर्शन dishes_pot_pan_speech (~44%) में दिखा, जो किचन शोर से मिलती‑जुलती आवाज़ों के कारण हो सकता है।",
      "confidence कैसे समझें": "Confidence एक संभाव्यता है। >80% मजबूत, 60–80% संभावित, <60% पर ऑडियो जांचें।",
      "डेटा कहाँ स्टोर होता है": "सभी प्रोसेसिंग डिवाइस पर स्थानीय होती है। डिटेक्शन इतिहास ऐप में रहता है; जब तक आप एक्सपोर्ट न करें, ऑडियो बाहर नहीं जाता।",
      "सूचनाएं": "Settings में Notifications चालू करें ताकि चुनी हुई आवाज़ों पर अलर्ट मिलें।",
      "इतिहास एक्सपोर्ट": "History टैब से CSV या साझा सार (share) के रूप में एक्सपोर्ट कर सकते हैं।",
      "सपोर्टेड फॉर्मैट": "टेस्ट के लिए WAV या M4A फाइलों का उपयोग करें। रिकॉर्डिंग के लिए PCM/WAV बेहतर हैं।",
    },
    pa: {
      // Project-focused Q&A (Punjabi)
      "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ": "SoundAware ਡਿਵਾਈਸ 'ਤੇ TensorFlow Lite ਮਾਡਲ ਚਲਾਂਦਾ ਹੈ। ਐਪ ਛੋਟੇ ਆਡੀਓ ਸੈਕਸ਼ਨਾਂ 'ਤੇ ਇਨਫਰੈਂਸ ਕਰਦਾ ਹੈ ਅਤੇ ਡਿਟੈਕਸ਼ਨ ਤੇ confidence ਦਿਖਾਉਂਦਾ ਹੈ।",
      "ਕੌਣ‑ਕੌਣ ਕਲਾਸਾਂ ਹਨ": "ਮਾਡਲ 12 ਟਾਰਗੇਟ ਕਲਾਸਾਂ ਨੂੰ ਪਛਾਣਦਾ ਹੈ — ਉਦਾਹਰਨ ਲਈ ਤਾਲੀਆਂ, ਕੁੱਤੇ ਦੀ ਭੌਂਕ, ਡ੍ਰਿਲ, ਗਨਸ਼ਾਟ, ਬਿੱਲੀ, ਰੋਣਾ, ਬਰਤਨ, ਡੋਰਬੇਲ, ਕਾਂਚ ਟੁੱਟਣਾ, ਸਲੈਮ ਅਤੇ ਟਾਇਲਟ ਫਲਸ਼।",
      "ਕਿੰਨੀਆਂ ਕਲਾਸਾਂ ਹਨ": "ਕੁੱਲ 12 ਟਾਰਗੇਟ ਕਲਾਸਾਂ ਹਨ; ਕੁਝ ਵਿੱਚ speech/no‑speech ਵਰਜ਼ਨ ਵੀ ਹਨ।",
      "ਮਾਡਲ ਦੀ ਸਹੀਤਾ": "ਟੈਸਟ ਸੈੱਟ 'ਤੇ ਮਾਡਲ ਦੀ ਕੁੱਲ ਸਹੀਤਾ ਲਗਭਗ 71.4% ਹੈ। ਹਰ ਕਲਾਸ ਦੀ ਸਹੀਤਾ ਵੱਖਰੀ ਹੁੰਦੀ ਹੈ।",
      "ਸਭ ਤੋਂ ਵਧੀਆ ਕਲਾਸ": "applause_no_speech ਸਭ ਤੋਂ ਵਧੀਆ ਹੈ (~97%)।",
      "ਸਭ ਤੋਂ ਮੁਸ਼ਕਲ ਕਲਾਸ": "dishes_pot_pan_speech ਸਭ ਤੋਂ ਘੱਟ (~44%) ਦੇ ਨਾਲ ਮੁਸ਼ਕਲ ਹੈ।",
      "confidence ਕਿਵੇਂ ਸਮਝੀਏ": "Confidence ਲੇਬਲ ਦੀ ਸੰਭਾਵਨਾ ਹੈ। >80% ਮਜ਼ਬੂਤ, 60–80% ਸੰਭਵ, <60% 'ਤੇ ਆਡੀਓ ਦਿਖੋ।",
      "ਡੇਟਾ ਕਿੱਥੇ ਸਟੋਰ ਹੁੰਦਾ ਹੈ": "ਸਾਰੀ ਪ੍ਰੋਸੈਸਿੰਗ ਡਿਵਾਈਸ 'ਤੇ ਹੁੰਦੀ ਹੈ। ਇਤਿਹਾਸ ਐਪ ਵਿੱਚ ਰਹਿੰਦਾ ਹੈ; ਜਦ ਤੱਕ ਤੁਸੀਂ exported ਨਾ ਕਰੋ, ਆਡੀਓ ਬਾਹਰ ਨਹੀਂ ਜਾਂਦੀ।",
    },
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    const userQuery = inputText.trim();
    setInputText('');
    // First check local predefined responses (fast path)
    try {
      const lang = currentLanguage || 'en';
      const map = predefinedResponses[lang] || predefinedResponses['en'] || {};
      const normalized = userQuery.replace(/[?؟।!]/g, '').trim();
      const lower = normalized.toLowerCase();
      const foundKey = Object.keys(map).find(k => k.toLowerCase() === lower || k === normalized || k === userQuery);
      if (foundKey) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: map[foundKey],
          isUser: false,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        return;
      }
    } catch (err) {
      // fallback to remote generation if anything goes wrong
      console.warn('predefinedResponses lookup failed', err);
    }

    // Generate AI response
    generateResponse(userQuery).then((aiResponse) => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponse.text,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Add suggestion buttons if available
      if (aiResponse.suggestions && aiResponse.suggestions.length > 0) {
        setTimeout(() => {
          const suggestionMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            text: `${currentLanguage === 'hi' ? 'सुझाव' : 'Suggestions'}: ${aiResponse.suggestions?.join(', ')}`,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, suggestionMessage]);
        }, 500);
      }
    }).catch((error) => {
      console.error('AI Response Error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: currentLanguage === 'hi' 
          ? 'क्षमा करें, मुझे कुछ तकनीकी समस्या हो रही है। कृपया दोबारा कोशिश करें।'
          : 'Sorry, I\'m experiencing some technical difficulties. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    });
  };

  const quickQuestions = currentLanguage === 'hi' ? [
    'कैसे काम करता है?',
    'क्लास कौन‑कौन सी हैं?',
    'मॉडल की कुल सटीकता क्या है?',
    'सबसे अच्छा क्लास कौन सा है?',
    'सबसे कठिन क्लास कौन सी है?',
    'confidence कैसे समझें?',
    'मदद चाहिए?',
  ] : currentLanguage === 'pa' ? [
    'ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ?',
    'ਕੌਣ‑ਕੌਣ ਕਲਾਸਾਂ ਹਨ?',
    'ਮਾਡਲ ਦੀ ਕੁੱਲ ਸਹੀਤਾ ਕੀ ਹੈ?',
    'ਕਿਹੜੀ ਕਲਾਸ ਸਭ ਤੋਂ ਵਧੀਆ ਹੈ?',
    'ਕਿਹੜੀ ਕਲਾਸ ਸਭ ਤੋਂ ਮੁਸ਼ਕਲ ਹੈ?',
    'confidence ਕਿਵੇਂ ਸਮਝੀਏ?',
    'ਮਦਦ ਚਾਹੀਦੀ ਹੈ?',
  ] : [
    'How does it work?',
    'What classes can it detect?',
    'What is the total accuracy of the model?',
    'Which class has the highest accuracy?',
    'Which class is the most difficult for the model?',
    'How do I interpret confidence?',
    'Help and support?',
  ];

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100)} style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: colors.text }]}>{t('aiAssistant')}</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('askAboutSound')}
        </Text>
      </Animated.View>

      {/* Quick Questions */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.quickQuestions}>
        <View style={styles.quickQuestionsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickQuestionsContent}
            style={[styles.quickQuestionsScroll, Platform.OS === 'web' && styles.quickQuestionsScrollWeb]}
            ref={scrollViewRef}
            // attach id for web CSS targeting
            nativeID="quickQuestionsScroll"
            onContentSizeChange={(w, h) => setQuickContentWidth(w)}
            onLayout={(e) => setQuickContainerWidth(e.nativeEvent.layout.width)}
            onScroll={(e) => setQuickScrollX(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
          >
          {quickQuestions.map((question, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.quickQuestion, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                setInputText(question);
                setTimeout(() => sendMessage(), 100);
              }}
            >
              <Text style={[styles.quickQuestionText, { color: colors.primary }]}>
                {question}
              </Text>
            </TouchableOpacity>
          ))}
          </ScrollView>

          {/* subtle left/right gradient fades to indicate scrollable content while scrollbar is invisible */}
          {quickContentWidth > quickContainerWidth && quickScrollX > 8 && (
            <LinearGradient
              colors={[colors.background, `${colors.background}00`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.quickFade, styles.quickFadeLeft]}
              pointerEvents="none"
            />
          )}
          {quickContentWidth > quickContainerWidth && (quickContentWidth - (quickScrollX + quickContainerWidth) > 8) && (
            <LinearGradient
              colors={[`${colors.background}00`, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.quickFade, styles.quickFadeRight]}
              pointerEvents="none"
            />
          )}
        </View>
      </Animated.View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message, index) => (
          <Animated.View
            key={message.id}
            entering={message.isUser ? SlideInRight.delay(100) : SlideInLeft.delay(100)}
            style={[
              styles.messageWrapper,
              message.isUser ? styles.userMessageWrapper : styles.aiMessageWrapper
            ]}
          >
            <Card style={[
              styles.messageCard,
              {
                backgroundColor: message.isUser ? colors.primary : colors.card,
                width: '85%',
                alignSelf: message.isUser ? 'flex-end' : 'flex-start',
              }
            ]}>
              <View style={styles.messageHeader}>
                <Text style={[
                  styles.messageText,
                  { color: message.isUser ? colors.background : colors.text }
                ]}>
                  {message.text}
                </Text>
              </View>
              <Text style={[
                styles.messageTime,
                { color: message.isUser ? colors.background : colors.textSecondary }
              ]}>
                {message.timestamp.toLocaleTimeString()}
              </Text>
            </Card>
          </Animated.View>
        ))}
        
        {isProcessing && (
          <Animated.View entering={SlideInLeft} style={styles.aiMessageWrapper}>
            <Card style={[styles.messageCard, { backgroundColor: colors.card }]}>
              <View style={styles.typingIndicator}>
                <Text style={[styles.typingText, { color: colors.textSecondary }]}>
                  {t('aiTyping')}
                </Text>
                <View style={styles.typingDots}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                </View>
              </View>
            </Card>
          </Animated.View>
        )}
      </ScrollView>

      {/* Input */}
      <Animated.View entering={FadeInDown.delay(300)} style={[styles.inputContainer, { borderTopColor: colors.border }]}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            placeholder={t('askAnything')}
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={sendMessage}
            multiline
            maxLength={500}
          />
          {/* Voice input removed per user preference */}
          <TouchableOpacity
            style={[
              styles.sendButton, 
              { 
                backgroundColor: inputText.trim() ? colors.primary : colors.border,
              }
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isProcessing}
          >
            <Send size={20} color={inputText.trim() ? colors.background : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
  },
  quickQuestions: {
    paddingVertical: 16,
  },
  quickQuestionsScroll: {
    maxHeight: 50,
  },
  quickQuestionsScrollWeb: {
    // These web-specific properties are intentionally permissive; they map to DOM CSS on web builds
    // show horizontal overflow on web so the browser renders a visible scrollbar/track
    // Use DOM-style properties but cast to any to satisfy TypeScript's ViewStyle typing
    // @ts-ignore
    overflowX: 'auto',
    // @ts-ignore
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 6,
  } as any,
  quickQuestionsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  quickQuestionsWrapper: {
    position: 'relative',
  },
  quickFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 40,
    zIndex: 3,
  },
  quickFadeLeft: {
    left: 0,
  },
  quickFadeRight: {
    right: 0,
  },
  quickQuestion: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickQuestionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 100,
  },
  messageWrapper: {
    marginBottom: 16,
  },
  userMessageWrapper: {
    alignItems: 'flex-end',
  },
  aiMessageWrapper: {
    alignItems: 'flex-start',
  },
  messageCard: {
    padding: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    width: '100%',
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    opacity: 0.7,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  inputContainer: {
    borderTopWidth: 1,
    padding: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    // Remove default browser focus outline on web
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    maxHeight: 100,
    minHeight: 20,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});