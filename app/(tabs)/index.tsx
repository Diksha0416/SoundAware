import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSoundDetection } from '@/contexts/SoundDetectionContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
// AudioVisualizer intentionally not used on the Home page to avoid overlapping visual elements
import { Activity, Mic, Bell, TrendingUp, Volume2, Clock, ChartBar as BarChart3 } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const isSmallScreen = width <= 420;

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const router = useRouter();
  const { detections, isRecording } = useSoundDetection();
  const { addNotification, unreadCount } = useNotifications();
  const [stats, setStats] = useState({
    todayDetections: 0,
    mostCommon: 'None',
    accuracy: 0,
    weeklyDetections: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    calculateStats();
  }, [detections]);

  const calculateStats = () => {
    const today = new Date().toDateString();
    const todayDetections = detections.filter(d => d.timestamp.toDateString() === today).length;
    
    // Weekly detections
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyDetections = detections.filter(d => d.timestamp >= weekAgo).length;
    
    const soundCounts: { [key: string]: number } = {};
    detections.forEach(d => {
      soundCounts[d.soundType] = (soundCounts[d.soundType] || 0) + 1;
    });
    
    const mostCommon = Object.keys(soundCounts).length > 0 
      ? Object.keys(soundCounts).reduce((a, b) => soundCounts[a] > soundCounts[b] ? a : b)
      : 'None';
    
    const avgAccuracy = detections.length > 0
      ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
      : 0;

    setStats({
      todayDetections,
      mostCommon,
      accuracy: Math.round(avgAccuracy * 100),
      weeklyDetections,
    });
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    calculateStats();
    setTimeout(() => {
      setRefreshing(false);
      addNotification({
        title: currentLanguage === 'hi' ? 'डेटा रिफ्रेश हुआ' : 'Data Refreshed',
        message: currentLanguage === 'hi' ? 'आंकड़े और डेटा अपडेट हो गए हैं' : 'Statistics and data have been updated',
        type: 'info',
      });
    }, 1000);
  }, [currentLanguage]);

  const quickStartRecording = () => {
    router.push('/record');
    addNotification({
      title: currentLanguage === 'hi' ? 'रिकॉर्डिंग शुरू हुई' : 'Recording Started',
      message: currentLanguage === 'hi' ? 'ध्वनि पहचान अब सक्रिय है' : 'Sound detection is now active',
      type: 'info',
    });
  };

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const filteredDetections = selectedClass ? detections.filter(d => d.soundType === selectedClass) : detections;
  const recentDetections = filteredDetections.slice(0, 5);

  // Live preview / simulation state (for nicer landing experience)
  const [simIndex, setSimIndex] = useState(0);
  const [simConfidence, setSimConfidence] = useState(0.72);
  const simPulse = useSharedValue(1);

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  // Cycle simulation when there are few or no recent detections to make the Home feel alive
  useEffect(() => {
    let t: any = null;
    if (detections.length === 0 || recentDetections.length === 0) {
      t = setInterval(() => {
        setSimIndex(i => (i + 1) % modelClasses.length);
        // random-ish confidence between .45 and .95 but biased
        setSimConfidence(() => Math.round((0.45 + Math.random() * 0.5) * 100) / 100);
        simPulse.value = withTiming(1.12, { duration: 600 }, () => {
          simPulse.value = withTiming(1, { duration: 800 });
        });
      }, 2200);
    }
    return () => { if (t) clearInterval(t); };
  }, [detections.length]);

  const simPulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: simPulse.value }],
    };
  });

  // Canonical model classes (used to display Detection Capabilities)
  const modelClasses = [
    "applause_no_speech", "applause_speech",
    "cat_meowing_no_speech", "cat_meowing_speech",
    "cough_no_speech", "cough_speech",
    "crying_no_speech", "crying_speech",
    "dishes_pot_pan_no_speech", "dishes_pot_pan_speech",
    "dog_barking_no_speech", "dog_barking_speech",
    "doorbell_no_speech", "doorbell_speech",
    "drill_no_speech", "drill_speech",
    "glass_breaking_no_speech", "glass_breaking_speech",
    "gun_shot_no_speech", "gun_shot_speech",
    "slam_no_speech", "slam_speech",
    "toilet_flush_no_speech", "toilet_flush_speech"
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: isSmallScreen ? 30 : 50 }]}>
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { padding: isSmallScreen ? 16 : 20 }]} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header (title + subtitle inline, aligned with header padding) */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text, fontSize: isSmallScreen ? 28 : styles.title.fontSize }]}>{t('appName')}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.text, fontSize: isSmallScreen ? 15 : 17, marginTop: 6 } ]}>From Meows to Doorbells, Coughs to Gunshots — If it makes noise, SoundAware knows</Text>
        </Animated.View>

        {/* Status Card */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Card style={[styles.statusCard, { backgroundColor: isRecording ? colors.success : colors.card }]}>
            <View style={styles.statusContent}>
              <Activity size={24} color={isRecording ? colors.background : colors.primary} />
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusText, { 
                  color: isRecording ? colors.background : colors.text 
                }]}>
                  {isRecording ? t('activelyMonitoring') : t('monitoringPaused')}
                </Text>
                <Text style={[styles.statusSubtext, { 
                  color: isRecording ? colors.background : colors.textSecondary 
                }]}>
                  {isRecording ? 'Listening for sounds...' : 'Tap record to start'}
                </Text>
              </View>
            </View>
            
            {/* Audio Visualizer (removed orange spectrum to avoid overlap) */}
            <View style={styles.visualizerContainer}>
              {/* intentionally left blank to remove animated spectrum */}
            </View>
          </Card>
        </Animated.View>

        {/* Enhanced Stats Row: realtime rate, confidence trend, top sounds */}
        <Animated.View entering={FadeInRight.delay(300)} style={[styles.statsRow, { flexWrap: 'wrap' }]}>
          {/* Detection Rate (last 5 minutes) */}
          <Card style={[styles.statCard, isSmallScreen ? { flexBasis: '100%', marginBottom: 10 } : { flexBasis: '30%' }]}>
            <Text style={[styles.statSmallLabel, { color: colors.textSecondary }]}>Detection Rate</Text>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {(() => {
                const now = Date.now();
                const fiveMinAgo = new Date(now - 5 * 60 * 1000);
                const recent = detections.filter(d => d.timestamp >= fiveMinAgo);
                const perMin = Math.round((recent.length / 5) * 10) / 10;
                return `${perMin}/min`;
              })()}
            </Text>
            <View style={styles.sparklineContainer}>
              {Array.from({ length: 12 }).map((_, i) => {
                // build a tiny sparkline based on recent detection timestamps
                const bucket = i;
                const bucketSizeMs = (5 * 60 * 1000) / 12;
                const bucketStart = Date.now() - (12 - bucket) * bucketSizeMs;
                const count = detections.filter(d => d.timestamp.getTime() >= bucketStart && d.timestamp.getTime() < bucketStart + bucketSizeMs).length;
                const h = Math.min(36, 4 + count * 8);
                return <View key={i} style={[styles.sparkBar, { height: h, backgroundColor: colors.primary, marginRight: 4 }]} />;
              })}
            </View>
          </Card>

          {/* Confidence Trend */}
          <Card style={[styles.statCard, isSmallScreen ? { flexBasis: '100%', marginBottom: 10 } : { flexBasis: '30%' }]}>
            <Text style={[styles.statSmallLabel, { color: colors.textSecondary }]}>Confidence Trend</Text>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {(() => {
                const last10 = detections.slice(0, 10);
                const avg = last10.length ? Math.round((last10.reduce((s, d) => s + d.confidence, 0) / last10.length) * 100) : stats.accuracy;
                return `${avg}%`;
              })()}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {(() => {
                const last8 = detections.slice(0, 8);
                const basis = last8.length ? last8 : Array.from({ length: 8 }, () => ({ confidence: Math.random() * 0.6 + 0.3 }));
                return basis.map((d, i) => (
                  <View key={i} style={{ width: 10, height: Math.max(6, Math.round(d.confidence * 36)), backgroundColor: d.confidence > 0.6 ? colors.success : colors.secondary, borderRadius: 4 }} />
                ));
              })()}
            </View>
          </Card>

          {/* Top Sounds */}
          <Card style={[styles.statCard, isSmallScreen ? { flexBasis: '100%' } : { flexBasis: '30%' }]}>
            <Text style={[styles.statSmallLabel, { color: colors.textSecondary }]}>Top Sounds</Text>
            <View style={{ marginTop: 6 }}>
              {(() => {
                const counts: { [k: string]: number } = {};
                detections.forEach(d => counts[d.soundType] = (counts[d.soundType] || 0) + 1);
                const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
                if (top.length === 0) return <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No data yet</Text>;
                return top.map((tname, idx) => (
                  <View key={tname} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 }}>
                    <Text style={[styles.chipText, { color: colors.text }]}>{tname.replace(/_/g, ' ')}</Text>
                    <Text style={{ color: colors.textSecondary }}>{counts[tname]}</Text>
                  </View>
                ));
              })()}
            </View>
          </Card>
        </Animated.View>

        {/* (Removed) AI Model Status - using canonical class list below instead */}

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(400)}>
          <Card style={styles.actionsCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('quickActions')}</Text>
            <View style={[styles.actionButtons, isSmallScreen ? { flexWrap: 'wrap' } : {}]}>
              <Button
                title={t('startRecording')}
                onPress={quickStartRecording}
                icon={<Mic size={20} color={colors.background} />}
                style={isSmallScreen ? StyleSheet.flatten([styles.actionButton, { minWidth: 140, marginBottom: 8 }]) : styles.actionButton}
              />
              <Button
                title={`${t('viewAlerts')} ${unreadCount > 0 ? `(${unreadCount})` : ''}`}
                onPress={() => router.push('/notifications')}
                variant="outline"
                icon={<Bell size={20} color={colors.primary} />}
                style={isSmallScreen ? StyleSheet.flatten([styles.actionButton, { minWidth: 140 }]) : styles.actionButton}
              />
            </View>
          </Card>
        </Animated.View>

        {/* Recent Detections */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <Card style={styles.recentCard}>
            {/* Live preview panel: shows a simulated detection when there are no recent detections */}
            <View style={[styles.livePreviewRow, isSmallScreen ? { flexWrap: 'wrap', justifyContent: 'flex-start' } : {}]}>
              <View style={[styles.livePulseWrap, { borderColor: colors.primary }]}> 
                <Animated.View style={[styles.livePulse, simPulseStyle, { backgroundColor: colors.primary } as any]} />
                <View style={styles.liveLabelWrap}>
                  <Text style={[styles.liveLabel, { color: colors.text }]}>{recentDetections.length > 0 ? recentDetections[0].soundType : modelClasses[simIndex].replace(/_/g, ' ')}</Text>
                  <Text style={[styles.liveSub, { color: colors.textSecondary }]}>
                    {recentDetections.length > 0 ? `${Math.round((recentDetections[0].confidence || 0) * 100)}%` : `${Math.round(simConfidence * 100)}% confidence`}
                  </Text>
                </View>
              </View>

              {/* Mini sparkline removed to avoid orange waveform on the Home page */}
            </View>
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('recentDetections')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {selectedClass ? (
                  <TouchableOpacity onPress={() => setSelectedClass(null)}>
                    <Text style={[styles.viewAllText, { color: colors.primary }]}>Clear filter</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => router.push('/history')}>
                  <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {recentDetections.length > 0 ? (
              recentDetections.map((detection, index) => (
                <Animated.View 
                  key={detection.id}
                  entering={FadeInRight.delay(600 + index * 100)}
                  style={[styles.detectionItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.detectionInfo}>
                    <Text style={[styles.detectionSound, { color: colors.text }]}>
                      {detection.soundType}
                    </Text>
                    <View style={styles.detectionMeta}>
                      <Clock size={12} color={colors.textSecondary} />
                      <Text style={[styles.detectionTime, { color: colors.textSecondary }]}>
                        {getTimeAgo(detection.timestamp)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.confidenceContainer}>
                    <View style={[styles.confidenceBar, { backgroundColor: colors.border }]}>
                      <View style={[
                        styles.confidenceFill,
                        { 
                          backgroundColor: colors.primary,
                          width: `${detection.confidence * 100}%`
                        }
                      ]} />
                    </View>
                    <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>
                      {Math.round(detection.confidence * 100)}%
                    </Text>
                  </View>
                </Animated.View>
              ))
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('noDetectionsYet')}
              </Text>
            )}
          </Card>
        </Animated.View>

        {/* ML Model Info */}
        <Animated.View entering={FadeInDown.delay(600)}>
          <Card style={styles.modelCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Detection Capabilities</Text>
            <View style={styles.modelInfo}>
              <Text style={[styles.modelSubtitle, { color: colors.textSecondary }]}>Listed below are the exact classes this model can detect. Tap a class in History to filter.</Text>

              <View style={styles.chipsContainer}>
                {modelClasses.map((c) => {
                  const selected = selectedClass === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setSelectedClass(prev => prev === c ? null : c)}
                      activeOpacity={0.8}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? colors.primary : colors.card,
                          borderColor: selected ? colors.primary : 'transparent'
                        }
                      ]}
                    >
                      <Text style={[styles.chipText, { color: selected ? colors.background : colors.text }]}>
                        {c.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  heroBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    marginTop: 6,
    lineHeight: 20,
  },
  statusCard: {
    marginBottom: 20,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  statusSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  visualizerContainer: {
    marginTop: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  statSmallLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    alignSelf: 'flex-start'
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  actionsCard: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  recentCard: {
    marginBottom: 20,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  detectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  detectionInfo: {
    flex: 1,
  },
  detectionSound: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  detectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detectionTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  confidenceContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  confidenceBar: {
    width: 60,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    width: 35,
    textAlign: 'right',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  modelCard: {
    marginBottom: 20,
  },
  modelStatusCard: {
    marginBottom: 20,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modelTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    flex: 1,
  },
  modelStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modelStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  modelMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  metricValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  modelInfo: {
    gap: 12,
  },
  livePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  livePulseWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  livePulse: {
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  liveLabelWrap: {
    flexDirection: 'column',
  },
  liveLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  liveSub: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 10,
    flex: 1,
    justifyContent: 'flex-end'
  },
  sparkBar: {
    width: 8,
    borderRadius: 4,
  },
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  modelSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
});