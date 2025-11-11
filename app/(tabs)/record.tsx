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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
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
  const { addDetection, isRecording, setIsRecording, autoRecording, stopAutoRecording } = useSoundDetection();
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

      if ((Platform as any).OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      addNotification({
        title: currentLanguage === 'hi' ? 'रिकॉर्डिंग शुरू हुई' : 'Recording Started',
        message: currentLanguage === 'hi' ? 'घरेलू आवाजों को सुन रहे हैं...' : 'Listening for household sounds...',
        type: 'info',
      });
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  }

  async function stopRecording() {
    if (!recording) return;

    setIsRecording(false);
    setIsProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
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
        const form = new FormData();
        // determine filename and mime-type
        const filename = uploadedFile || `recording${Date.now()}.wav`;
        const ext = filename.includes('.') ? filename.split('.').pop() : 'wav';
        let mime = 'audio/wav';
        if (ext === 'm4a' || ext === 'aac') mime = 'audio/mp4';
        else if (ext === 'mp3') mime = 'audio/mpeg';
        else if (ext === 'flac') mime = 'audio/flac';

        // For web, uri is a blob URL and must be appended as a Blob/File.
        // For native (Expo) append an object with { uri, name, type }.
        if ((Platform as any).OS === 'web') {
          // fetch the blob from the blob:// or data URL
          const resp = await fetch(uri);
          const blob = await resp.blob();
          form.append('file', blob, filename);
        } else {
          form.append('file', { uri, name: filename, type: mime } as any);
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

        const r = await fetch(backendUrl, {
          method: 'POST',
          body: form,
          // Do not set content-type header; let fetch set the multipart boundary
        });

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
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('recordTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('recordSubtitle')}
          </Text>
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

        {/* Model Status */}
        <Animated.View entering={FadeInDown.delay(600)}>
          <Card style={styles.statusCard}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Detection Status</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Sensitivity:</Text>
              <Text style={[styles.statusValue, { color: colors.primary }]}>
                {Math.round(modelSettings.sensitivity * 100)}%
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Confidence Threshold:</Text>
              <Text style={[styles.statusValue, { color: colors.primary }]}>
                {Math.round(modelSettings.confidenceThreshold * 100)}%
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Max Duration:</Text>
              <Text style={[styles.statusValue, { color: colors.primary }]}>
                {modelSettings.maxDuration}s
              </Text>
            </View>
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