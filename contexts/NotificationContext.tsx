import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  clearAll: () => Promise<boolean>;
  restoreNotifications: (items: Notification[]) => Promise<void>;
  unreadCount: number;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);

  useEffect(() => {
    loadNotifications();
    loadNotificationSettings();
  }, []);

  const loadNotifications = async () => {
    try {
      const saved = await AsyncStorage.getItem('notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        setNotifications(parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
      }
    } catch (error) {
      console.log('Error loading notifications:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('notifications_enabled');
      if (saved !== null) {
        setNotificationsEnabledState(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading notification settings:', error);
    }
  };

  const setNotificationsEnabled = async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    try {
      await AsyncStorage.setItem('notifications_enabled', JSON.stringify(enabled));
    } catch (error) {
      console.log('Error saving notification settings:', error);
    }
  };

  const addNotification = async (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    // Don't add notification if notifications are disabled
    if (!notificationsEnabled) {
      return;
    }

    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };

    const updated = [newNotification, ...notifications].slice(0, 50);
    setNotifications(updated);

    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(updated));
    } catch (error) {
      console.log('Error saving notification:', error);
    }
  };

  const markAsRead = async (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);

    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(updated));
    } catch (error) {
      console.log('Error updating notification:', error);
    }
  };

  const clearAll = async (): Promise<boolean> => {
    try {
      // First clear from AsyncStorage
      await AsyncStorage.removeItem('notifications');
      // Then update the state
      setNotifications([]);
      return true; // Indicate success
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return false; // Indicate failure
    }
  };

  const restoreNotifications = async (items: Notification[]) => {
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(items));
      setNotifications(items);
    } catch (error) {
      console.error('Error restoring notifications:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
    notifications,
    addNotification,
    markAsRead,
    clearAll,
    restoreNotifications,
    unreadCount,
    notificationsEnabled,
    setNotificationsEnabled,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}