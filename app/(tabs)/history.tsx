import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
// Use legacy API to avoid SDK 54 writeAsStringAsync deprecation until we migrate to the new File/Directory API
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSoundDetection } from '@/contexts/SoundDetectionContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, Volume2, Trash2, Filter, Search, Download, Share, ChartBar as BarChart3 } from 'lucide-react-native';
import Animated, { FadeInDown, SlideInRight } from 'react-native-reanimated';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { t, currentLanguage, setLanguage, availableLanguages } = useLanguage();
  const { detections, clearHistory } = useSoundDetection();
  const { addNotification } = useNotifications();
  const [filter, setFilter] = useState<string>('all');
  const [showStats, setShowStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const filteredDetections = filter === 'all' 
    ? detections 
    : detections.filter(d => d.soundType.toLowerCase().includes(filter.toLowerCase()));

  const groupedDetections = filteredDetections.reduce((groups: { [key: string]: typeof detections }, detection) => {
    const ts = new Date((detection as any).timestamp);
    const date = ts.toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(detection);
    return groups;
  }, {});

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return colors.success;
    if (confidence >= 0.6) return colors.warning;
    return colors.error;
  };

  const soundTypes = [...new Set(detections.map(d => d.soundType))];

  const exportHistory = async () => {
    if (detections.length === 0) {
      addNotification({
        title: t('exportFailed'),
        message: 'No detections to export',
        type: 'warning',
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const csvHeader = 'Date,Time,Sound Type,Confidence (%),Duration (seconds)\n';
      const csvRows = detections.map(d => {
        const ts = new Date((d as any).timestamp);
        return `"${ts.toLocaleDateString()}","${ts.toLocaleTimeString()}","${d.soundType}",${Math.round(d.confidence * 100)},${d.duration}`;
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `SoundAware_Detections_${dateStr}.csv`;
      
      if (Platform.OS === 'web') {
        // Web download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        addNotification({
          title: t('exportSuccess'),
          message: `${t('csvExported')} (${detections.length} ${t('totalDetections')})`,
          type: 'success',
        });
      } else {
        // Mobile export
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: t('exportCsv'),
          });
        }
        
        addNotification({
          title: t('exportSuccess'),
          message: `${t('csvExported')} (${detections.length} ${t('totalDetections')})`,
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      addNotification({
        title: t('exportFailed'),
        message: 'Unable to create CSV file. Please try again.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const shareHistory = async () => {
    if (detections.length === 0) {
      addNotification({
        title: t('shareFailed'),
        message: 'No detections to share',
        type: 'warning',
      });
      return;
    }

    setIsSharing(true);
    
    try {
      const dateStr = new Date().toLocaleDateString();
      const stats = getStats();
      
      const summary = `🔊 SoundAware Detection Summary - ${dateStr}

📊 Statistics:
• Total Detections: ${stats.totalDetections}
• Average Confidence: ${Math.round(stats.avgConfidence * 100)}%
• Most Common Sound: ${stats.mostCommon}

📋 Recent Detections:
${detections.slice(0, 5).map(d => {
  const ts = new Date((d as any).timestamp);
  return `• ${d.soundType} (${Math.round(d.confidence * 100)}%) - ${ts.toLocaleString()}`;
}).join('\n')}

Generated by SoundAware - AI-Powered Sound Detection App`;
      
      if (Platform.OS === 'web') {
        // Web sharing using Web Share API or fallback
        if (navigator.share) {
          await navigator.share({
            title: 'SoundAware Detection Summary',
            text: summary,
          });
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(summary);
          addNotification({
            title: t('shareSuccess'),
            message: 'Summary copied to clipboard',
            type: 'success',
          });
        }
      } else {
        // Mobile sharing
        const fileName = `SoundAware_Summary_${new Date().toISOString().split('T')[0]}.txt`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, summary);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/plain',
            dialogTitle: t('share'),
          });
        }
        
        addNotification({
          title: t('shareSuccess'),
          message: t('summaryShared'),
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      addNotification({
        title: t('shareFailed'),
        message: 'Unable to prepare summary for sharing. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const getStats = () => {
    const totalDetections = detections.length;
    const avgConfidence = detections.length > 0 
      ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length 
      : 0;
    const mostCommon = soundTypes.length > 0 
      ? soundTypes.reduce((a, b) => 
          detections.filter(d => d.soundType === a).length > 
          detections.filter(d => d.soundType === b).length ? a : b
        )
      : 'None';
    
    return { totalDetections, avgConfidence, mostCommon };
  };

  const stats = getStats();

  // Advanced / real-time statistics derived from detections
  const computeAdvancedStats = (windowMinutes = 30) => {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // series: counts per minute for the last `windowMinutes`
    const series: number[] = new Array(windowMinutes).fill(0);
    detections.forEach(d => {
      const ts = new Date((d as any).timestamp).getTime();
      const delta = now - ts;
      if (delta >= 0 && delta <= windowMs) {
        const idx = Math.floor((windowMs - delta) / (60 * 1000));
        const clamped = Math.max(0, Math.min(windowMinutes - 1, idx));
        series[clamped] = (series[clamped] || 0) + 1;
      }
    });

    // diversity (Shannon entropy) across detected classes in the window
    const counts: Record<string, number> = {};
    const windowDetections = detections.filter(d => (now - new Date((d as any).timestamp).getTime()) <= windowMs);
    windowDetections.forEach(d => counts[d.soundType] = (counts[d.soundType] || 0) + 1);
    const totalWindow = windowDetections.length || 1;
    let entropy = 0;
    Object.values(counts).forEach((c) => {
      const p = c / totalWindow;
      entropy -= p * Math.log2(p);
    });

    // rarity / rare events: classes seen <= threshold in full history
    const rarityThreshold = 2;
    const globalCounts: Record<string, number> = {};
    detections.forEach(d => globalCounts[d.soundType] = (globalCounts[d.soundType] || 0) + 1);
    const rareEvents = Object.keys(globalCounts).filter(k => globalCounts[k] <= rarityThreshold).length;

    // confidence buckets
    const buckets = [0,0,0,0,0]; // 0-20,20-40,...80-100
    detections.slice(-200).forEach(d => {
      const idx = Math.min(4, Math.floor((d.confidence || 0) * 5));
      buckets[idx] = (buckets[idx] || 0) + 1;
    });

    // surge: compare last 5 minutes avg vs previous 25 minutes avg
    const recentMinutes = 5;
    const recentSum = series.slice(-recentMinutes).reduce((s, v) => s + v, 0);
    const prevSum = series.slice(0, Math.max(0, series.length - recentMinutes)).reduce((s, v) => s + v, 0);
    const recentAvg = recentSum / Math.max(1, recentMinutes);
    const prevAvg = prevSum / Math.max(1, series.length - recentMinutes);
    const surge = prevAvg === 0 ? (recentAvg > 0 ? 999 : 0) : Math.round(((recentAvg - prevAvg) / prevAvg) * 100);

    return { series, entropy, rareEvents, buckets, surge, windowDetections };
  };

  const advanced = computeAdvancedStats(30);

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await setLanguage(languageCode);
      setShowLanguageSelector(false);
      
      const languageName = availableLanguages.find((l: { code: string }) => l.code === languageCode)?.nativeName || languageCode;
      
      Alert.alert(
        languageCode === 'hi' ? 'भाषा बदली गई' : 'Language Changed',
        languageCode === 'hi' 
          ? `भाषा ${languageName} में अपडेट हो गई`
          : `Language updated to ${languageName}`,
        [{ text: t('ok') }]
      );
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(
        t('error'),
        currentLanguage === 'hi' 
          ? 'भाषा बदलने में त्रुटि हुई' 
          : 'Error changing language',
        [{ text: t('ok') }]
      );
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      t('clearHistory'),
      currentLanguage === 'hi' 
        ? 'क्या आप वाकई सभी पहचान इतिहास को साफ़ करना चाहते हैं?'
        : 'Are you sure you want to clear all detection history?',
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('confirm'), 
          style: 'destructive',
          onPress: () => {
            clearHistory();
            addNotification({
              title: currentLanguage === 'hi' ? 'इतिहास साफ़ हो गया' : 'History Cleared',
              message: currentLanguage === 'hi' 
                ? 'सभी पहचान इतिहास हटा दिया गया है'
                : 'All detection history has been removed',
              type: 'info',
            });
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Animated.View entering={FadeInDown.delay(100)}>
          <Text style={[styles.title, { color: colors.text }]}>{t('historyTitle')}</Text>
          {/* marketing subtitle shown inline under title (no boxed container) */}
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginTop: 6 } ]}>From morning meows to midnight doorbells — see everything SoundAware heard</Text>
        </Animated.View>
      </View>

      {/* Filter and Search */}
      <Animated.View entering={FadeInDown.delay(200)} style={styles.filterContainer}>
        <Card style={styles.filterCard}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                { 
                  backgroundColor: filter === 'all' ? colors.primary : colors.surface,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => setFilter('all')}
            >
              <Text style={[
                styles.filterChipText,
                { color: filter === 'all' ? colors.background : colors.text }
              ]}>
                {t('all')}
              </Text>
            </TouchableOpacity>
            
            {soundTypes.slice(0, 3).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  { 
                    backgroundColor: filter === type ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setFilter(filter === type ? 'all' : type)}
              >
                <Text style={[
                  styles.filterChipText,
                  { color: filter === type ? colors.background : colors.text }
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity
            style={styles.statsToggle}
            onPress={() => setShowStats(!showStats)}
          >
            <BarChart3 size={16} color={colors.primary} />
            <Text style={[styles.statsToggleText, { color: colors.primary }]}>
              {showStats ? t('hideStatistics') : t('showStatistics')}
            </Text>
          </TouchableOpacity>
        </Card>
      </Animated.View>

      {/* Statistics (moved into scrollable history to avoid blocking page scroll) */}

      {/* Actions */}
      <Animated.View entering={FadeInDown.delay(300)} style={styles.actionsContainer}>
        <Button
          title={t('exportCsv')}
          onPress={exportHistory}
          variant="ghost"
          icon={<Download size={18} color={colors.primary} />}
          size="small"
          disabled={isExporting || detections.length === 0}
        />
        
        <Button
          title={t('share')}
          onPress={shareHistory}
          variant="ghost"
          icon={<Share size={18} color={colors.secondary} />}
          size="small"
          disabled={isSharing || detections.length === 0}
        />
        
        <Button
          title={t('clearHistory')}
          onPress={handleClearHistory}
          variant="outline"
          icon={<Trash2 size={18} color={colors.error} />}
          size="small"
          disabled={detections.length === 0}
        />
      </Animated.View>

      {/* History List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Insert stats inside the same scroll container so user can scroll past them */}
        {showStats && (
          <Animated.View entering={FadeInDown.delay(250)} style={styles.statsContainer}>
            <Card style={styles.statsCard}>
                <Text style={[styles.statsTitle, { color: colors.text }]}>{t('detectionStatistics')}</Text>
                {/* Advanced live metrics */}
                <View style={styles.advancedGrid}>
                  <View style={styles.advancedItem}>
                    <Text style={[styles.advLabel, { color: colors.textSecondary }]}>Detection Rate (last 30m)</Text>
                    <View style={[styles.sparklineBox, { backgroundColor: colors.surface }]}> 
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 48 }}>
                        {advanced.series.map((v, i) => (
                          <View key={i} style={{ width: 6, marginRight: 2, height: Math.max(2, (v / Math.max(1, Math.max(...advanced.series))) * 44), backgroundColor: colors.primary, borderRadius: 2 }} />
                        ))}
                      </View>
                    </View>
                    <Text style={[styles.advSmall, { color: colors.textSecondary }]}>{`${detections.length} total • ${Math.round((advanced.series.reduce((s,a)=>s+a,0)/30)*60)} / hr (est)`}</Text>
                  </View>

                  <View style={styles.advancedItem}>
                    <Text style={[styles.advLabel, { color: colors.textSecondary }]}>Diversity (entropy)</Text>
                    <Text style={[styles.advValue, { color: colors.accent }]}>{advanced.entropy.toFixed(2)}</Text>
                    <Text style={[styles.advSmall, { color: colors.textSecondary }]}>Higher = more varied detections</Text>
                  </View>

                  <View style={styles.advancedItem}>
                    <Text style={[styles.advLabel, { color: colors.textSecondary }]}>Rare Events</Text>
                    <Text style={[styles.advValue, { color: colors.error }]}>{advanced.rareEvents}</Text>
                    <Text style={[styles.advSmall, { color: colors.textSecondary }]}>Classes with ≤2 total occurrences</Text>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.advLabel, { color: colors.textSecondary }]}>Confidence Distribution (recent)</Text>
                  <View style={{ marginTop: 8 }}>
                    {advanced.buckets.map((b, i) => (
                      <View key={i} style={styles.bucketRow}>
                        <Text style={[styles.bucketLabel, { color: colors.text }]}>{`${i*20}-${i*20+20}%`}</Text>
                        <View style={[styles.bucketOuter, { backgroundColor: colors.surface }]}>
                          <View style={[styles.bucketInner, { width: `${(b / Math.max(1, advanced.buckets.reduce((s,n)=>s+n,0))) * 100}%`, backgroundColor: colors.primary }]} />
                        </View>
                        <Text style={[styles.bucketCount, { color: colors.textSecondary }]}>{b}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.surgeRow}>
                    <Text style={[styles.advLabel, { color: colors.textSecondary }]}>Recent Surge</Text>
                    <Text style={[styles.surgeValue, { color: advanced.surge > 50 ? colors.error : colors.success }]}>{advanced.surge === 999 ? 'New' : `${advanced.surge}%`}</Text>
                    <Text style={[styles.advSmall, { color: colors.textSecondary }]}>{'Compare last 5m vs previous'}</Text>
                  </View>
                </View>
            </Card>
          </Animated.View>
        )}
        {Object.keys(groupedDetections).length > 0 ? (
          Object.entries(groupedDetections).map(([date, dayDetections], dateIndex) => (
            <Animated.View
              key={date}
              entering={FadeInDown.delay(400 + dateIndex * 100)}
              style={styles.dateSection}
            >
              <Text style={[styles.dateHeader, { color: colors.textSecondary }]}>
                {new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
              
              {dayDetections.map((detection, index) => (
                <Animated.View
                  key={detection.id}
                  entering={SlideInRight.delay(500 + dateIndex * 100 + index * 50)}
                >
                  <Card style={styles.detectionCard}>
                    <View style={styles.detectionHeader}>
                      <View style={styles.detectionInfo}>
                        <Text style={[styles.soundType, { color: colors.text }]}>
                          {detection.soundType}
                        </Text>
                        <View style={styles.metaInfo}>
                          <Clock size={14} color={colors.textSecondary} />
                          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                            {new Date((detection as any).timestamp).toLocaleTimeString()}
                          </Text>
                          <Volume2 size={14} color={colors.textSecondary} />
                          <Text style={[styles.durationText, { color: colors.textSecondary }]}>
                            {detection.duration}s
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.confidenceContainer}>
                        <Text style={[
                          styles.confidenceText,
                          { color: getConfidenceColor(detection.confidence) }
                        ]}>
                          {Math.round(detection.confidence * 100)}%
                        </Text>
                        <View style={[styles.confidenceBar, { backgroundColor: colors.border }]}>
                          <View style={[
                            styles.confidenceFill,
                            { 
                              backgroundColor: getConfidenceColor(detection.confidence),
                              width: `${detection.confidence * 100}%`
                            }
                          ]} />
                        </View>
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={FadeInDown.delay(400)} style={styles.emptyContainer}>
            <Card style={styles.emptyCard}>
              <Volume2 size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Detections Yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('noDetectionsYet')}
              </Text>
            </Card>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    padding: 20,
    paddingBottom: 0,
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
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    lineHeight: 20,
  },
  filterContainer: {
    padding: 20,
    paddingTop: 16,
  },
  filterCard: {
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
    paddingLeft: 4,
  },
  detectionCard: {
    marginBottom: 12,
  },
  detectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detectionInfo: {
    flex: 1,
  },
  soundType: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    // use spacing on child elements for cross-platform support
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginLeft: 6,
  },
  durationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginLeft: 6,
  },
  confidenceContainer: {
    alignItems: 'flex-end',
    // spacing via margins on children
  },
  confidenceText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  confidenceBar: {
    width: 100,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  statsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'center',
  },
  statsToggleText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statsCard: {
    padding: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  /* Advanced stats styles */
  advancedGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  advancedItem: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    backgroundColor: 'transparent',
    marginRight: 8,
    marginBottom: 8,
  },
  advLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginBottom: 6,
  },
  advValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  advSmall: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 6,
  },
  sparklineBox: {
    height: 56,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    marginTop: 6,
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bucketLabel: {
    width: 56,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  bucketOuter: {
    flex: 1,
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  bucketInner: {
    height: '100%',
  },
  bucketCount: {
    width: 36,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    textAlign: 'right',
  },
  surgeRow: {
    marginTop: 12,
  },
  surgeValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginTop: 4,
  },
});