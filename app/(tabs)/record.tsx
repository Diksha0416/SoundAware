import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Constants from 'expo-constants';
import { useSoundDetection } from '@/contexts/SoundDetectionContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMLModel } from '@/contexts/MLModelContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AudioVisualizer } from '@/components/ui/AudioVisualizer';
import { Audio } from 'expo-av';
// Helper: convert arbitrary audio blob/uri to 16kHz mono WAV (browser only)
async function convertToWavBlobWeb(uri: string, targetRate = 16000): Promise<Blob> {
  // fetch source
  const resp = await fetch(uri);
  const arrayBuffer = await resp.arrayBuffer();

  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API not available');
  const audioCtx = new AudioCtx();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Use OfflineAudioContext to resample to targetRate and mix to mono
  const offlineCtx = new (window as any).OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetRate), targetRate);
  const bufferSource = offlineCtx.createBufferSource();
  // create a mono buffer by copying channels into a single channel
  const tmpBuf = offlineCtx.createBuffer(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    tmpBuf.copyToChannel(audioBuffer.getChannelData(ch), ch);
  }
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start(0);
  const rendered = await offlineCtx.startRendering();
  const channelData = rendered.getChannelData(0);

  // encode float32 samples to 16-bit PCM WAV
  function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      output.setInt16(offset, s, true);
    }
  }

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  const samples = channelData;
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */ writeString(view, 0, 'RIFF');
  /* file length */ view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */ writeString(view, 8, 'WAVE');
  /* format chunk identifier */ writeString(view, 12, 'fmt ');
  /* format chunk length */ view.setUint32(16, 16, true);
  /* sample format (raw) */ view.setUint16(20, 1, true);
  /* channel count */ view.setUint16(22, 1, true);
  /* sample rate */ view.setUint32(24, targetRate, true);
  /* byte rate (sampleRate * blockAlign) */ view.setUint32(28, targetRate * 2, true);
  /* block align (channelCount * bytesPerSample) */ view.setUint16(32, 2, true);
  /* bits per sample */ view.setUint16(34, 16, true);
  /* data chunk identifier */ writeString(view, 36, 'data');
  /* data chunk length */ view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: 'audio/wav' });
}
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Mic, Square, Upload, Play, Pause, FileAudio, CircleCheck as CheckCircle } from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  FadeInDown,
  FadeInUp 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function RecordScreen() {
  const { colors } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const { addDetection, isRecording, setIsRecording, autoRecording, stopAutoRecording, detections } = useSoundDetection();
  const { addNotification } = useNotifications();
  const { modelSettings, processAudio } = useMLModel();
  
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPrediction, setLastPrediction] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const pulseAnim = useSharedValue(1);
  const waveAnim = useSharedValue(0);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const animatedPulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseAnim.value }],
    };
  });

  const animatedWaveStyle = useAnimatedStyle(() => {
    return {
      opacity: waveAnim.value,
      transform: [{ scale: 1 + waveAnim.value * 0.3 }],
    };
  });

  React.useEffect(() => {
    if (isRecording) {
      pulseAnim.value = withRepeat(withTiming(1.1, { duration: 1000 }), -1, true);
      waveAnim.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
      
      // Start duration counter
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      pulseAnim.value = withTiming(1);
      waveAnim.value = withTiming(0);
      
      // Clear duration counter
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (chunkInterval.current) {
        clearInterval(chunkInterval.current);
      }
    };
  }, [isRecording]);

  async function startRecording() {
    try {
      if (permissionResponse?.status !== 'granted') {
        const permission = await requestPermission();
        if (permission.status !== 'granted') {
          Alert.alert(
            'Permission Required', 
            'Audio recording permission is needed to detect sounds'
          );
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      // Try to keep the device awake while recording (guarded and non-fatal)
      const activateKeepAwakeSafely = async () => {
        try {
          if ((Platform as any).OS === 'web') return;
          const KeepAwake: any = await import('expo-keep-awake');
          // Try common API names across versions
          if (KeepAwake.activateKeepAwake) {
            await KeepAwake.activateKeepAwake();
          } else if (KeepAwake.preventAutoLockAsync) {
            await KeepAwake.preventAutoLockAsync();
          } else if (KeepAwake.activateAsync) {
            await KeepAwake.activateAsync();
          }
        } catch (e) {
          console.warn('keep-awake activation failed (ignored):', e);
        }
      };
      void activateKeepAwakeSafely();
      if ((Platform as any).OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      addNotification({
        title: currentLanguage === 'hi' ? 'रिकॉर्डिंग शुरू हुई' : 'Recording Started',
        message: currentLanguage === 'hi' ? 'घरेलू आवाजों को सुन रहे हैं...' : 'Listening for household sounds...',
        type: 'info',
      });

      // Start chunked uploads: every 2 seconds, finalize the current recording chunk and upload it
      try {
  const CHUNK_SEC = 3;
        if (chunkInterval.current) clearInterval(chunkInterval.current);
        chunkInterval.current = setInterval(async () => {
          try {
            if (!recording) return;
            // Stop current recording chunk
            await recording.stopAndUnloadAsync();
            // give the runtime a moment to finish writing the file
            await new Promise((res) => setTimeout(res, 1000));
            const uri = recording.getURI();
            if (uri) {
              // Fire-and-forget processing of the chunk (uploads to backend)
              processAudioFile(uri).catch(e => console.warn('Chunk upload failed', e));
            }
            // Start a new recording chunk
            const { recording: newRec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(newRec);
          } catch (err) {
            console.warn('Chunk capture error', err);
          }
        }, CHUNK_SEC * 1000);
      } catch (e) {
        console.warn('Failed to start chunked uploads', e);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  }

  async function stopRecording() {
    if (!recording) return;

    setIsRecording(false);
    setIsProcessing(true);

    // Attempt to re-enable normal sleep behavior (non-fatal)
    const deactivateKeepAwakeSafely = async () => {
      try {
        if ((Platform as any).OS === 'web') return;
        const KeepAwake: any = await import('expo-keep-awake');
        if (KeepAwake.deactivateKeepAwake) {
          await KeepAwake.deactivateKeepAwake();
        } else if (KeepAwake.allowScreenSleepAsync) {
          await KeepAwake.allowScreenSleepAsync();
        } else if (KeepAwake.deactivateAsync) {
          await KeepAwake.deactivateAsync();
        }
      } catch (e) {
        console.warn('keep-awake deactivation failed (ignored):', e);
      }
    };
    void deactivateKeepAwakeSafely();

    try {
      // stop chunking loop immediately to avoid creating a new segment while stopping
      if (chunkInterval.current) {
        clearInterval(chunkInterval.current);
        chunkInterval.current = null;
      }
  await recording.stopAndUnloadAsync();
  // small delay to ensure file is flushed to disk
  await new Promise((res) => setTimeout(res, 1000));
  const uri = recording.getURI();
      
      if (uri) {
        await processAudioFile(uri);
      }

      setRecording(null);
      
      // If auto recording was enabled but user manually stopped, disable auto recording
      if (autoRecording) {
        stopAutoRecording();
        addNotification({
          title: currentLanguage === 'hi' ? 'स्वचालित रिकॉर्डिंग बंद' : 'Auto Recording Stopped',
          message: currentLanguage === 'hi' ? 'मैन्युअल रूप से रोकने के कारण स्वचालित रिकॉर्डिंग बंद हो गई' : 'Auto recording disabled due to manual stop',
          type: 'info',
        });
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setIsProcessing(false);
      addNotification({
        title: 'Recording Error',
        message: 'Failed to process recording. Please try again.',
        type: 'error',
      });
    }
  }

  const processAudioFile = async (uri: string) => {
    try {
      // If running in the browser, upload the file to the backend /predict endpoint
      // so the backend TFLite model (contexts/model_int8.tflite) does the inference.
      const BACKEND_BASE = (global as any).BACKEND_URL || 'http://192.168.29.32:5000';
      const PRED_URL = `${BACKEND_BASE}/predict`;

      // Try to upload to backend for inference on all platforms (web & native).
      // For React Native / Expo, fetch with FormData and a file object ({ uri, name, type }) works.
    try {
      // Helper: try to convert a native recorded file to 16kHz mono WAV using ffmpeg-kit
      const tryConvertNativeToWav = async (inputUri: string): Promise<string | null> => {
        try {
          const mod = await import('ffmpeg-kit-react-native');
          const FFmpegKit = (mod as any).FFmpegKit;
          if (!FFmpegKit) return null;

          const inPath = inputUri.startsWith('file://') ? inputUri.replace('file://', '') : inputUri;
          const outPath = FileSystem.cacheDirectory + `conv_${Date.now()}.wav`;
          const cmd = `-y -i "${inPath}" -ar 16000 -ac 1 "${outPath}"`;
          const session = await FFmpegKit.execute(cmd);
          const rc = await session.getReturnCode();
          if (rc && rc.isValueSuccess && rc.isValueSuccess()) {
            return outPath;
          }
          console.warn('[ffmpeg-kit] conversion failed rc=', rc);
          return null;
        } catch (e) {
          return null;
        }
      };

      // Prepare upload form. For web we convert to a 16kHz mono WAV blob before uploading.
      const form = new FormData();
      const derivedName = uri.split('/').pop() || `recording${Date.now()}.wav`;
      // force filename to .wav for backend clarity
      const filename = (uploadedFile || derivedName).replace(/\.[^/.]+$/, '') + '.wav';

      if ((Platform as any).OS === 'web') {
        // convert to WAV (16kHz mono) in-browser to match server expectations
        try {
          const wavBlob = await convertToWavBlobWeb(uri, 16000);
          form.append('file', wavBlob, filename);
        } catch (e) {
          console.warn('Web WAV conversion failed, falling back to raw blob', e);
          const resp = await fetch(uri);
          const blob = await resp.blob();
          form.append('file', blob, filename);
        }
      } else {
        // Native: attempt on-device conversion with ffmpeg-kit (if available)
        let convertedPath: string | null = null;
        try {
          convertedPath = await tryConvertNativeToWav(uri);
        } catch (e) {
          convertedPath = null;
        }

        if (convertedPath) {
          form.append('file', { uri: convertedPath, name: filename, type: 'audio/wav' } as any);
        } else {
          // Fall back to original file and rely on server-side ffmpeg conversion (server must have ffmpeg installed)
          form.append('file', { uri, name: filename, type: 'audio/wav' } as any);
          try {
            addNotification({
              title: currentLanguage === 'hi' ? 'डिवाइस कन्वर्शन अनुपलब्ध' : 'Device conversion unavailable',
              message: currentLanguage === 'hi'
                ? 'Local conversion (ffmpeg-kit) अनुपलब्ध है। बेहतर परिणामों के लिए एक prebuilt dev client बनाएं।'
                : 'Local ffmpeg conversion (ffmpeg-kit) is not available. Consider a prebuilt dev client for on-device conversion.',
              type: 'info',
            });
          } catch (_e) {}
        }
      }

        // derive an effective backend URL so Expo Go on device uses the dev machine IP
        let backendUrl = PRED_URL;
        try {
          // If PRED_URL is localhost/127.0.0.1, try to derive the LAN IP from Expo Constants
          const usesLocal = !backendUrl || backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
          if (usesLocal) {
            // Expo provides debuggerHost like '192.168.29.32:8081' when running via LAN
            const dbg = (Constants && (Constants.manifest?.debuggerHost || (Constants.manifest2 && Constants.manifest2.debuggerHost))) || null;
            if (dbg) {
              const derivedIp = dbg.split(':')[0];
              backendUrl = `http://${derivedIp}:5000/predict`;
            } else if (typeof window !== 'undefined' && window.location && window.location.hostname) {
              backendUrl = `http://${window.location.hostname}:5000/predict`;
            }
          }
        } catch (e) {
          console.warn('Could not derive backend URL from Expo Constants', e);
        }

        // Upload with a single retry for 5xx errors
        let r = await fetch(backendUrl, { method: 'POST', body: form });
        if (!r.ok && r.status >= 500) {
          // wait briefly then retry once
          await new Promise((res) => setTimeout(res, 500));
          r = await fetch(backendUrl, { method: 'POST', body: form });
        }

        if (!r.ok) {
          const txt = await r.text();
          throw new Error(`Server error ${r.status}: ${txt}`);
        }

        const json = await r.json();

        // json contains pred_label, pred_idx, scores
        const label = json.pred_label || json.pred_label || 'Unknown';
        const confidence = json.scores && typeof json.pred_idx === 'number' ? json.scores[json.pred_idx] : null;

        addDetection({
          soundType: label,
          confidence: confidence ?? 0,
          duration: 0,
          audioUri: uri,
        });

        setLastPrediction(`${label}${confidence ? ` (${Math.round(confidence * 100)}%)` : ''}`);
        setIsProcessing(false);

        addNotification({
          title: currentLanguage === 'hi' ? 'ध्वनि पहचानी गई' : 'Sound Detected',
          message: currentLanguage === 'hi'
            ? `पहचानी गई: ${label} ${confidence ? Math.round(confidence * 100) : ''}% विश्वास के साथ`
            : `Identified: ${label} with ${confidence ? Math.round(confidence * 100) : ''}% confidence`,
          type: (confidence ?? 0) > 0.8 ? 'success' : 'warning',
        });

        if ((Platform as any).OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return;
      } catch (err) {
        console.warn('Backend upload failed, falling back to local model:', err);
        // If the server reported ffmpeg/conversion missing, surface a clearer message to the user
        try {
          const msg = err && (err as any).message ? (err as any).message : String(err);
          if (typeof msg === 'string' && (msg.toLowerCase().includes('conversion not available') || msg.toLowerCase().includes('ffmpeg not found') || msg.toLowerCase().includes('audio_to_mel_image failed'))) {
            addNotification({
              title: currentLanguage === 'hi' ? 'सर्वर कन्वर्शन अनुपलब्ध' : 'Server conversion missing',
              message: currentLanguage === 'hi'
                ? 'बैकएंड पर ffmpeg अनुपलब्ध है। फोन से अपलोड किए गए फ़ाइलों को सर्वर पर WAV में बदलने के लिए ffmpeg इंस्टॉल करें (विकास मशीन पर) या ngrok का उपयोग करें।'
                : 'ffmpeg is missing on the backend. Install ffmpeg on the dev machine so uploaded files can be converted to WAV, or use a tunnel (ngrok) as a workaround.',
              type: 'warning',
            });
          }
        } catch (_e) {
          // swallow
        }
        // fallback to local processing below
      }

      // Fallback for native or when backend fails: use the existing local model processing
      const result = await processAudio(uri, modelSettings.sensitivity);

      addDetection({
        soundType: result.soundType,
        confidence: result.confidence,
        duration: result.duration,
        audioUri: uri,
      });

      setLastPrediction(`${result.soundType} (${Math.round(result.confidence * 100)}%)`);
      setIsProcessing(false);

      addNotification({
        title: currentLanguage === 'hi' ? 'ध्वनि पहचानी गई' : 'Sound Detected',
        message: currentLanguage === 'hi' 
          ? `पहचानी गई: ${result.soundType} ${Math.round(result.confidence * 100)}% विश्वास के साथ`
          : `Identified: ${result.soundType} with ${Math.round(result.confidence * 100)}% confidence`,
        type: result.confidence > 0.8 ? 'success' : 'warning',
      });

      if ((Platform as any).OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Processing/upload error', error);
      setIsProcessing(false);
      const errMsg = error instanceof Error ? error.message : String(error);
      addNotification({
        title: 'Processing Error',
        message: `Failed to analyze audio file. ${errMsg}`,
        type: 'error',
      });
    }
  };

  const pickAudioFile = async () => {
    setIsUploading(true);
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        
        // Check file size (50MB limit)
        if (file.size && file.size > 50 * 1024 * 1024) {
          addNotification({
            title: 'File Too Large',
            message: 'Please select a file smaller than 50MB',
            type: 'error',
          });
          setIsUploading(false);
          return;
        }

        // Check file format
        const supportedFormats = ['.mp3', '.wav', '.m4a', '.aac', '.flac'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!supportedFormats.includes(fileExtension)) {
          addNotification({
            title: 'Unsupported Format',
            message: 'Please select MP3, WAV, M4A, AAC, or FLAC files',
            type: 'error',
          });
          setIsUploading(false);
          return;
        }

        setUploadedFile(file.name);
        setIsProcessing(true);
        setIsUploading(false);

        addNotification({
          title: 'File Uploaded',
          message: `Processing ${file.name}...`,
          type: 'info',
        });

        await processAudioFile(file.uri);
      } else {
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      setIsUploading(false);
      addNotification({
        title: 'Upload Error',
        message: 'Failed to upload audio file. Please try again.',
        type: 'error',
      });
    }
  };

  const playLastRecording = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      if (recording) {
        const uri = recording.getURI();
        if (uri) {
          const { sound: newSound } = await Audio.Sound.createAsync({ uri });
          setSound(newSound);
          setIsPlaying(true);
          
          await newSound.playAsync();
          
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      addNotification({
        title: 'Playback Error',
        message: 'Failed to play audio',
        type: 'error',
      });
    }
  };

  const pausePlayback = async () => {
    try {
      if (sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
        {/* Header (title + subtitle inline, aligned with header padding) */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('recordTitle')}</Text>
          {/* larger subtitle aligned with header padding */}
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary, fontSize: 17, marginTop: 8 }]}>Your home has drama — coughs, cries, claps, barks, and even the toilet flush… SoundAware catches every episode</Text>
        </Animated.View>

        {/* Recording Interface */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.recordingContainer}>
          <Card style={styles.recordingCard}>
            {/* Audio Visualizer */}
            <View style={styles.visualizerContainer}>
              <AudioVisualizer isActive={isRecording} type="circle" height={120} />
            </View>
            
            {/* Wave Animation */}
            {isRecording && (
              <Animated.View style={[styles.waveCircle, animatedWaveStyle, { borderColor: colors.primary }]} />
            )}
            
            {/* Main Recording Button */}
            <Animated.View style={animatedPulseStyle}>
              <Button
                title=""
                onPress={isRecording ? stopRecording : startRecording}
                style={([styles.recordButton, { backgroundColor: isRecording ? colors.error : colors.primary }] as any)}
                icon={isRecording ? <Square size={32} color={colors.background} /> : <Mic size={32} color={colors.background} />}
                disabled={isProcessing || isUploading}
              />
            </Animated.View>

            <Text style={[styles.recordingStatus, { color: colors.textSecondary }]}>
              {isProcessing ? t('processing') : isRecording ? `${t('recording')} ${formatDuration(recordingDuration)}` : t('tapToStart')}
            </Text>
            
            {/* Waveform Visualizer */}
            <View style={styles.waveformContainer}>
              <AudioVisualizer isActive={isRecording} type="bars" height={60} barCount={15} />
            </View>
          </Card>
        </Animated.View>

        {/* Last Prediction */}
        {lastPrediction && (
          <Animated.View entering={FadeInDown.delay(300)}>
            <Card style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <CheckCircle size={24} color={colors.success} />
                <Text style={[styles.predictionTitle, { color: colors.text }]}>{t('lastDetection')}</Text>
              </View>
              <Text style={[styles.predictionText, { color: colors.primary }]}>
                {lastPrediction}
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* Upload Option */}
        <Animated.View entering={FadeInDown.delay(400)}>
          <Card style={styles.uploadCard}>
            <View style={styles.uploadHeader}>
              <FileAudio size={24} color={colors.secondary} />
              <Text style={[styles.uploadTitle, { color: colors.text }]}>{t('uploadAudioFile')}</Text>
            </View>
            <Text style={[styles.uploadSubtitle, { color: colors.textSecondary }]}>
              {t('analyzePreRecorded')}
            </Text>
            <Text style={[styles.supportedFormats, { color: colors.textSecondary }]}>
              Supported: MP3, WAV, M4A, AAC, FLAC (Max 50MB)
            </Text>
            <Button
              title={isUploading ? 'Uploading...' : t('chooseFile')}
              onPress={pickAudioFile}
              variant="outline"
              icon={<Upload size={20} color={colors.primary} />}
              style={styles.uploadButton}
              disabled={isUploading || isProcessing || isRecording}
            />
            {uploadedFile && (
              <View style={styles.uploadedFileContainer}>
                <CheckCircle size={16} color={colors.success} />
                <Text style={[styles.uploadedFileName, { color: colors.success }]}>
                  Last uploaded: {uploadedFile}
                </Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Audio Controls */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <Card style={styles.controlsCard}>
            <Text style={[styles.controlsTitle, { color: colors.text }]}>{t('audioControls')}</Text>
            <View style={styles.controlsRow}>
              <Button
                title={t('playLast')}
                onPress={playLastRecording}
                variant="ghost"
                icon={<Play size={18} color={colors.primary} />}
                size="small"
                disabled={!recording || isRecording || isPlaying}
              />
              <Button
                title={t('pause')}
                onPress={pausePlayback}
                variant="ghost"
                icon={<Pause size={18} color={colors.primary} />}
                size="small"
                disabled={!isPlaying}
              />
            </View>
            
            {/* Recording Tips */}
            <View style={styles.tipsContainer}>
              <Text style={[styles.tipsTitle, { color: colors.text }]}>Recording Tips:</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                • Hold device close to sound source
              </Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                • Minimize background noise
              </Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                • Record for 3-10 seconds for best results
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Model Status - visual, responsive */}
        <Animated.View entering={FadeInDown.delay(600)}>
          <Card style={styles.statusCard}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Detection Status</Text>

            {/* prepare recent confidences for sparkline */}
            {/* recentConfs: array of numbers 0..1 */}
            {(() => {
              const recent = (detections || []).slice(-12).map(d => typeof d.confidence === 'number' ? d.confidence : 0);
              const recentConfs = recent.length ? recent : Array.from({ length: 8 }, () => Math.random() * 0.5 + 0.4);
              return (
                <View style={styles.statusGrid}>
                  {/* Sensitivity - circular badge */}
                  <View style={styles.statusTile}>
                    <View style={[styles.radialWrap, { borderColor: colors.primary }]}> 
                      <Text style={[styles.radialText, { color: colors.primary }]}>{Math.round(modelSettings.sensitivity * 100)}%</Text>
                    </View>
                    <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Sensitivity</Text>
                    <Text style={[styles.tileValue, { color: colors.text }]}>{modelSettings.sensitivity !== undefined ? (modelSettings.sensitivity >= 0.8 ? 'High' : modelSettings.sensitivity >= 0.6 ? 'Medium' : 'Low') : ''}</Text>
                  </View>

                  {/* Confidence Threshold + sparkline */}
                  <View style={styles.statusTile}>
                    <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Confidence Threshold</Text>
                    <View style={styles.progressBarRow}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.round(modelSettings.confidenceThreshold * 100)}%`, backgroundColor: colors.primary }]} />
                      </View>
                      <Text style={[styles.tileValue, { color: colors.primary }]}>{Math.round(modelSettings.confidenceThreshold * 100)}%</Text>
                    </View>
                    <View style={styles.sparklineRow}>
                      {recentConfs.map((c, i) => (
                        <View key={i} style={{ width: 8, height: Math.max(6, Math.round(c * 40)), backgroundColor: c > 0.6 ? colors.success : colors.secondary, marginRight: 6, borderRadius: 3 }} />
                      ))}
                    </View>
                  </View>

                  {/* Max Duration visual */}
                  <View style={styles.statusTile}>
                    <Text style={[styles.tileLabel, { color: colors.textSecondary }]}>Max Duration</Text>
                    <View style={styles.durationRow}>
                      <View style={[styles.durationPill, { borderColor: colors.primary }]}>
                        <Text style={[styles.durationPillText, { color: colors.primary }]}>{modelSettings.maxDuration}s</Text>
                      </View>
                      <View style={styles.durationBarTrack}>
                        <View style={[styles.durationBarFill, { width: `${Math.min(100, Math.round((modelSettings.maxDuration / 60) * 100))}%`, backgroundColor: colors.accent }]} />
                      </View>
                    </View>
                    <Text style={[styles.tileNote, { color: colors.textSecondary }]}>Quick durations yield faster, local results</Text>
                  </View>
                </View>
              );
            })()}
          </Card>
        </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  heroBox: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginTop: 6,
    lineHeight: 20,
  },
  recordingContainer: {
    marginBottom: 24,
  },
  recordingCard: {
    alignItems: 'center',
    paddingVertical: 40,
    position: 'relative',
  },
  visualizerContainer: {
    marginBottom: 20,
  },
  waveformContainer: {
    marginTop: 20,
    width: '100%',
  },
  waveCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  recordingStatus: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  predictionCard: {
    marginBottom: 20,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  predictionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  predictionText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  uploadCard: {
    marginBottom: 20,
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  uploadSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  supportedFormats: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  uploadButton: {
    alignSelf: 'flex-start',
  },
  uploadedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  uploadedFileName: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  controlsCard: {
    marginBottom: 20,
  },
  controlsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tipsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tipsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  statusCard: {
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusTile: {
    flexBasis: '30%',
    minWidth: 160,
    paddingVertical: 8,
  },
  radialWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  radialText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  tileLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginBottom: 6,
  },
  tileValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  tileNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 8,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  sparklineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  durationPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  durationPillText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  durationBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  durationBarFill: {
    height: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  statusValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
});