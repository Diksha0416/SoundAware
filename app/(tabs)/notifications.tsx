import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, useWindowDimensions } from 'react-native';
import Svg, { Path, G, Circle as SvgCircle, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useSoundDetection } from '@/contexts/SoundDetectionContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Bell, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, 
  Info, Circle as XCircle, Trash2, Filter, Volume2, Shield, Clock 
} from 'lucide-react-native';
import Animated, { FadeInDown, SlideInRight } from 'react-native-reanimated';

// --- Lightweight inline chart components (SVG) ---
type AnyDet = any;

function getHourlyBins(detections: AnyDet[], bins = 24) {
  const arr = new Array(bins).fill(0);
  detections.forEach(d => {
    const ts = d.timestamp instanceof Date ? d.timestamp : new Date(d.timestamp);
    const h = ts.getHours();
    const bin = Math.floor((h / 24) * bins) % bins;
    arr[bin] += 1;
  });
  return arr;
}

function TimelineAreaChart({ detections, colors, xLabel, yLabel, textColor }: { detections: AnyDet[]; colors: any; xLabel?: string; yLabel?: string; textColor?: string }) {
  // Use fixed viewBox width so the SVG can scale responsively inside its container
  const w = 600;
  const h = 80;
  const bins = useMemo(() => getHourlyBins(detections || [], 24), [detections]);
  const max = Math.max(1, ...bins);

  const step = w / (bins.length - 1 || 1);
  const points = bins.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 8) - 2;
    return { x, y };
  });

  const path = points.reduce((acc, p, i) => {
    return acc + (i === 0 ? `M ${p.x},${p.y}` : ` L ${p.x},${p.y}`);
  }, '');
  const areaPath = `${path} L ${w},${h} L 0,${h} Z`;

  return (
    <View style={{ width: '100%' }}>
      <View style={{ width: '100%', height: h }}>
        <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
          <Path d={areaPath} fill={colors.accent} opacity={0.12} />
          <Path d={path} fill="none" stroke={colors.accent} strokeWidth={2} />
          {points.map((p, i) => (
            <SvgCircle key={i} cx={p.x} cy={p.y} r={2} fill={colors.accent} />
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: textColor || colors.textSecondary, fontSize: 12 }}>{yLabel || ''}</Text>
        <Text style={{ color: textColor || colors.textSecondary, fontSize: 12 }}>{xLabel || ''}</Text>
      </View>
    </View>
  );
}

function DonutChart({ detections, colors, size = 120, totalLabel, textColor }: { detections: AnyDet[]; colors: any; size?: number; totalLabel?: string; textColor?: string }) {
  const counts: { [k: string]: number } = {};
  (detections || []).forEach((d: AnyDet) => { counts[d.soundType] = (counts[d.soundType] || 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>No data</Text>
      </View>
    );
  }

  const total = entries.reduce((s, e) => s + e[1], 0);
  const palette = [colors.primary, colors.secondary, colors.accent, colors.success, colors.warning, colors.error];
  const cx = size / 2; const cy = size / 2; const r = size / 2 - 6; const innerR = r * 0.6;

  let startAngle = -Math.PI / 2;
  const slices = entries.map(([k, v], i) => {
    const angle = (v / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const large = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    startAngle = endAngle;
    return { key: k, path, color: palette[i % palette.length], value: v };
  });

  // prepare legend - top 5
  const legend = slices.slice(0, 5).map(s => ({ key: s.key, color: s.color, value: s.value }));

  // Render donut responsively via viewBox
  return (
    <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet">
          <G>
            {slices.map(s => (
              <Path key={s.key} d={s.path} fill={s.color} />
            ))}
            {/* inner cutout */}
            <Path d={`M ${cx} ${cy} m -${innerR}, 0 a ${innerR},${innerR} 0 1,0 ${innerR * 2},0 a ${innerR},${innerR} 0 1,0 -${innerR * 2},0`} fill={colors.background} />
          </G>
        </Svg>
      </View>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontFamily: 'Inter-SemiBold' }}>{totalLabel ?? String(total)}</Text>
        <Text style={{ color: textColor || colors.textSecondary, fontSize: 12 }}>{'Total'}</Text>
      </View>

      <View style={{ marginTop: 8, width: '100%', paddingHorizontal: 8 }}>
        {legend.map((l, i) => (
          <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={{ width: 12, height: 12, backgroundColor: l.color, borderRadius: 3 }} />
            <Text style={{ color: textColor || colors.textSecondary, fontSize: 12 }}>{`${l.key.replace(/_/g, ' ')} (${Math.round((l.value / total) * 100)}%)`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Replace EventLineChart with a stacked hourly bar chart which is more meaningful on mobile
function StackedHourlyBarChart({ detections, colors, xLabel, yLabel, textColor }: { detections: AnyDet[]; colors: any; xLabel?: string; yLabel?: string; textColor?: string }) {
  const w = 700; // viewBox width
  const h = 120;
  // prepare hourly buckets per top categories
  const countsByHour: { [hour: number]: { [cat: string]: number } } = {};
  for (let i = 0; i < 24; i++) countsByHour[i] = {};

  const counts: { [k: string]: number } = {};
  (detections || []).forEach((d: AnyDet) => { counts[d.soundType] = (counts[d.soundType] || 0) + 1; });
  const topCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 4);
  const otherKey = 'other';

  (detections || []).forEach((d: AnyDet) => {
    const ts = d.timestamp instanceof Date ? d.timestamp : new Date(d.timestamp);
    const hIdx = ts.getHours();
    const k = topCats.includes(d.soundType) ? d.soundType : otherKey;
    countsByHour[hIdx][k] = (countsByHour[hIdx][k] || 0) + 1;
  });

  const maxStack = Math.max(1, ...Object.values(countsByHour).map(hour => Object.values(hour).reduce((s,n)=>s+n,0)));
  const palette = [colors.primary, colors.secondary, colors.accent, colors.success, colors.warning];

  const barWidth = w / 24;

  return (
    <View style={{ width: '100%' }}>
      <View style={{ width: '100%', height: h }}>
        <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
          {Array.from({ length: 24 }).map((_, hour) => {
            const hourCounts = countsByHour[hour];
            let yAcc = h;
            const stackItems = [...topCats, otherKey];
            return (
              <G key={hour}>
                {stackItems.map((cat, si) => {
                  const val = hourCounts[cat] || 0;
                  const height = (val / maxStack) * (h - 20);
                  const x = hour * barWidth + 2;
                  const y = yAcc - height;
                  yAcc = y;
                  const color = palette[si % palette.length];
                  return val > 0 ? (
                    <Rect key={cat} x={x} y={y} width={barWidth - 4} height={height} fill={color} />
                  ) : null;
                })}
                {/* hour label small */}
                <SvgText x={hour * barWidth + barWidth / 2} y={h - 2} fontSize={8} fill={textColor || colors.textSecondary} textAnchor="middle">{String(hour)}</SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: textColor || colors.textSecondary, fontSize: 12 }}>{yLabel || ''}</Text>
        <Text style={{ color: textColor || colors.textSecondary, fontSize: 12 }}>{xLabel || ''}</Text>
      </View>
    </View>
  );
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const { notifications, markAsRead, clearAll, unreadCount } = useNotifications();
  const { detections } = useSoundDetection();
  const [filter, setFilter] = useState<string>('all');

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle size={20} color={colors.success} />;
      case 'warning': return <AlertTriangle size={20} color={colors.warning} />;
      case 'error': return <XCircle size={20} color={colors.error} />;
      default: return <Info size={20} color={colors.primary} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return colors.success;
      case 'warning': return colors.warning;
      case 'error': return colors.error;
      default: return colors.primary;
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) {
      Alert.alert(
        currentLanguage === 'hi' ? 'कोई सूचना नहीं' : 'No Notifications',
        currentLanguage === 'hi' 
          ? 'साफ़ करने के लिए कोई सूचना नहीं है' 
          : 'There are no notifications to clear',
        [{ text: t('ok') }]
      );
      return;
    }

    Alert.alert(
      t('clearAll'),
      currentLanguage === 'hi' 
        ? 'क्या आप वाकई सभी सूचनाओं को साफ़ करना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।'
        : 'Are you sure you want to clear all notifications? This action cannot be undone.',
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('confirm'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAll();
              Alert.alert(
                currentLanguage === 'hi' ? 'सफल' : 'Success',
                currentLanguage === 'hi' 
                  ? 'सभी सूचनाएं सफलतापूर्वक हटा दी गई हैं' 
                  : 'All notifications have been cleared',
                [{ text: t('ok') }]
              );
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert(
                t('error'),
                currentLanguage === 'hi' 
                  ? 'सूचनाएं साफ़ करने में त्रुटि हुई' 
                  : 'Error clearing notifications',
                [{ text: t('ok') }]
              );
            }
          }
        }
      ]
    );
  };

  const markAllAsRead = () => {
    notifications.forEach(notification => {
      if (!notification.read) {
        markAsRead(notification.id);
      }
    });
  };

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

  // helper to avoid missing-translation placeholders
  const localize = (key: string, fallback: string) => {
    try {
      const v = t(key);
      if (!v || /missing\s+\"?en\.?/.test(v) || /missing/.test(v) || v === key) return fallback;
      return v;
    } catch (e) {
      return fallback;
    }
  };

  const labelSoundActivity = localize('soundActivityOverTime', 'Sound Activity Over Time');
  const labelSoundCategory = localize('soundCategoryChart', 'Sound Category Chart');
  const labelSoundTimeline = localize('soundDetectionTimeline', 'Sound Detection Timeline');
  const labelTimeHours = localize('timeHours', 'Time (hours)');
  const labelIntensity = localize('soundIntensity', 'Intensity');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={[styles.title, { color: colors.text }]}>{t('notificationsTitle')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}> 
              {unreadCount} {t('unreadNotifications')}
            </Text>
            {/* marketing subtitle moved into header and enlarged */}
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary, fontSize: 17, marginTop: 8 }]}>Instant updates — because your home never stops talking</Text>
          </Animated.View>
          </View>

        {/* Actions */}
        {notifications.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200)} style={styles.actionsContainer}>
            <View style={styles.filterRow}>
              {['all', 'success', 'warning', 'error', 'info'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    { 
                      backgroundColor: filter === type ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    }
                  ]}
                  onPress={() => setFilter(type)}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: filter === type ? colors.background : colors.text }
                  ]}>
                    {type === 'all' ? t('all') : type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.actionButtonsRow}>
              {unreadCount > 0 && (
                <Button
                  title="Mark All Read"
                  onPress={markAllAsRead}
                  variant="ghost"
                  icon={<CheckCircle size={18} color={colors.success} />}
                  size="small"
                />
              )}
              
              <Button
                title={t('clearAll')}
                onPress={handleClearAll}
                variant="outline"
                icon={<Trash2 size={18} color={colors.error} />}
                size="small"
              />
            </View>
          </Animated.View>
        )}

        {/* Activity Visualizations: Timeline, Sound Category (donut), Event Line */}
        {notifications.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250)} style={styles.quickStats}>
            <Card style={styles.visualizationsCard}>
              <View style={styles.visualRow}>
                {/* Timeline Area Chart */}
                <View style={styles.visCol}>
                  <Text style={[styles.visTitle, { color: colors.text }]}>{labelSoundActivity}</Text>
                  <TimelineAreaChart detections={detections} colors={colors} xLabel={labelTimeHours} yLabel={labelIntensity} textColor={colors.textSecondary} />
                </View>

                {/* Pie / Donut Chart */}
                <View style={[styles.visCol, styles.pieCol]}>
                  <Text style={[styles.visTitle, { color: colors.text }]}>{labelSoundCategory}</Text>
                  <DonutChart detections={detections} colors={colors} size={140} totalLabel={String(detections.length)} textColor={colors.textSecondary} />
                </View>
              </View>

              {/* Event Line Chart (full width) */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.visTitle, { color: colors.text }]}>{labelSoundTimeline}</Text>
                <StackedHourlyBarChart detections={detections} colors={colors} xLabel={labelTimeHours} yLabel={labelIntensity} textColor={colors.textSecondary} />
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification, index) => (
            <Animated.View 
              key={notification.id}
              entering={SlideInRight.delay(300 + index * 100)}
            >
              <TouchableOpacity
                onPress={() => markAsRead(notification.id)}
                style={styles.notificationWrapper}
              >
                <Card style={{
                  ...styles.notificationCard,
                  ...(!notification.read ? { 
                    borderLeftWidth: 4, 
                    borderLeftColor: getNotificationColor(notification.type),
                    backgroundColor: colors.surface,
                  } : {})
                }}>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      {getNotificationIcon(notification.type)}
                      <View style={styles.notificationInfo}>
                        <Text style={[
                          styles.notificationTitle,
                          { color: colors.text },
                          !notification.read && styles.unreadTitle
                        ]}>
                          {notification.title}
                        </Text>
                        <View style={styles.timeContainer}>
                          <Clock size={12} color={colors.textSecondary} />
                          <Text style={[styles.notificationTime, { color: colors.textSecondary }]}> 
                            {getTimeAgo(notification.timestamp)}
                          </Text>
                        </View>
                      </View>
                      {!notification.read && (
                        <View style={[styles.unreadDot, { backgroundColor: getNotificationColor(notification.type) }]} />
                      )}
                    </View>
                    
                    <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}> 
                      {notification.message}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={FadeInDown.delay(300)} style={styles.emptyContainer}>
            <Card style={styles.emptyCard}>
              <Bell size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('noNotifications')}</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}> 
                {t('seeAlertsHere')}
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
  actionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  quickStats: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  visualizationsCard: {
    padding: 12,
  },
  visualRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  visCol: {
    flex: 1,
    minWidth: 220,
  },
  pieCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  visTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
  },
  heroHeading: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    marginTop: 6,
    marginBottom: 6,
  },
  heroBox: {
    padding: 12,
    borderRadius: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    lineHeight: 20,
  },
  quickStatsCard: {
    padding: 16,
  },
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickStatText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  notificationWrapper: {
    marginBottom: 12,
  },
  notificationCard: {
    padding: 16,
  },
  notificationContent: {
    gap: 12,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  unreadTitle: {
    fontFamily: 'Inter-Bold',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  notificationMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
    paddingLeft: 32,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
});