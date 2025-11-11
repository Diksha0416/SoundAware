import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MLModelSettings {
  modelVersion: string;
  sensitivity: number;
  confidenceThreshold: number;
  enablePreprocessing: boolean;
  enablePostprocessing: boolean;
  batchSize: number;
  maxDuration: number;
  sampleRate: number;
}

interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  inferenceTime: number;
  lastUpdated: Date;
}

interface PredictionResult {
  soundType: string;
  confidence: number;
  duration: number;
  alternatives?: Array<{ soundType: string; confidence: number }>;
}

interface MLModelContextType {
  modelSettings: MLModelSettings;
  updateModelSettings: (settings: Partial<MLModelSettings>) => void;
  modelPerformance: ModelPerformance;
  processAudio: (audioUri: string, sensitivity?: number) => Promise<PredictionResult>;
  isModelLoaded: boolean;
  loadModel: () => Promise<void>;
  resetModel: () => void;
}

const defaultSettings: MLModelSettings = {
  modelVersion: 'v2.1.0',
  sensitivity: 0.75,
  confidenceThreshold: 0.6,
  enablePreprocessing: true,
  enablePostprocessing: true,
  batchSize: 32,
  maxDuration: 3,
  sampleRate: 16000,
};

const defaultPerformance: ModelPerformance = {
  accuracy: 0.89,
  precision: 0.87,
  recall: 0.91,
  f1Score: 0.89,
  inferenceTime: 150,
  lastUpdated: new Date(),
};

const MLModelContext = createContext<MLModelContextType | undefined>(undefined);

export function MLModelProvider({ children }: { children: React.ReactNode }) {
  const [modelSettings, setModelSettings] = useState<MLModelSettings>(defaultSettings);
  const [modelPerformance, setModelPerformance] = useState<ModelPerformance>(defaultPerformance);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
    loadModel();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('ml_model_settings');
      if (saved) {
        setModelSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.log('Error loading ML settings:', error);
    }
  };

  const updateModelSettings = async (newSettings: Partial<MLModelSettings>) => {
    const updated = { ...modelSettings, ...newSettings };
    setModelSettings(updated);
    
    try {
      await AsyncStorage.setItem('ml_model_settings', JSON.stringify(updated));
      
      // Real-time performance simulation based on settings
      const performanceImpact = {
        accuracy: updated.enablePreprocessing && updated.enablePostprocessing ? 0.02 : -0.01,
        inferenceTime: updated.batchSize > 64 ? 50 : -20,
      };
      
      setModelPerformance(prev => ({
        ...prev,
        accuracy: Math.min(0.99, Math.max(0.70, prev.accuracy + performanceImpact.accuracy)),
        inferenceTime: Math.max(50, prev.inferenceTime + performanceImpact.inferenceTime),
        lastUpdated: new Date(),
      }));
    } catch (error) {
      console.log('Error saving ML settings:', error);
    }
  };

  const loadModel = async () => {
    // Simulate model loading
    setTimeout(() => {
      setIsModelLoaded(true);
    }, 1000);
  };

  const processAudio = async (audioUri: string, sensitivity?: number): Promise<PredictionResult> => {
    // Send audio file to backend predict endpoint and return the model's prediction.
    const BACKEND_BASE = (global as any).BACKEND_URL || 'http://192.168.29.32:5000';
    const PRED_URL = `${BACKEND_BASE}/predict`;

    try {
      const form = new FormData();
      // derive filename and mime
      const filename = audioUri.split('/').pop() || `recording_${Date.now()}.wav`;
      const ext = filename.includes('.') ? filename.split('.').pop() : 'wav';
      let mime = 'audio/wav';
      if (ext === 'm4a' || ext === 'aac') mime = 'audio/mp4';
      else if (ext === 'mp3') mime = 'audio/mpeg';
      else if (ext === 'flac') mime = 'audio/flac';

      // For web, fetch the blob; for native, provide { uri, name, type }
      if (typeof window !== 'undefined' && (window as any).location) {
        const resp = await fetch(audioUri);
        const blob = await resp.blob();
        form.append('file', blob as any, filename);
      } else {
        form.append('file', { uri: audioUri, name: filename, type: mime } as any);
      }

      // Attempt POST to backend
      const res = await fetch(PRED_URL, { method: 'POST', body: form });
      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const json = await res.json();
      const pred_label: string = json.pred_label || (json.pred_label && String(json.pred_label)) || 'unknown';
      const pred_idx: number = typeof json.pred_idx === 'number' ? json.pred_idx : -1;
      const scores: number[] = Array.isArray(json.scores) ? json.scores : [];

      const confidence = pred_idx >= 0 && scores[pred_idx] != null ? scores[pred_idx] : (json.top_k && json.top_k[0] && json.top_k[0].score) || 0;

      // Update performance timing (approx)
      setModelPerformance(prev => ({ ...prev, inferenceTime: json.inference_time_ms || prev.inferenceTime, lastUpdated: new Date() }));

      return {
        soundType: pred_label,
        confidence: typeof confidence === 'number' ? confidence : 0,
        duration: json.duration || 0,
        alternatives: (json.top_k || []).slice(1, 3).map((it: any) => ({ soundType: it.label, confidence: it.score }))
      };
    } catch (error) {
      console.warn('processAudio: backend request failed', error);
      // If backend fails, return unknown with zero confidence (do NOT return static mock classes)
      return {
        soundType: 'unknown',
        confidence: 0,
        duration: 0,
      };
    }
  };

  const resetModel = async () => {
    setModelSettings(defaultSettings);
    setModelPerformance(defaultPerformance);
    try {
      await AsyncStorage.removeItem('ml_model_settings');
    } catch (error) {
      console.log('Error resetting ML settings:', error);
    }
  };

  return (
    <MLModelContext.Provider value={{
      modelSettings,
      updateModelSettings,
      modelPerformance,
      processAudio,
      isModelLoaded,
      loadModel,
      resetModel,
    }}>
      {children}
    </MLModelContext.Provider>
  );
}

export function useMLModel() {
  const context = useContext(MLModelContext);
  if (context === undefined) {
    throw new Error('useMLModel must be used within a MLModelProvider');
  }
  return context;
}