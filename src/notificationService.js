import { LocalNotifications } from '@capacitor/local-notifications';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';

// Deterministický hash řetězce na kladné 32-bitové celé číslo pro Capacitor ID
function hashStringTo32BitInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 1000000000;
}

function getNotificationIds(itemId) {
  const baseHash = hashStringTo32BitInt(itemId);
  return {
    id15m: baseHash * 2,       // Sudé ID pro 15min předstih
    idStart: baseHash * 2 + 1  // Liché ID pro přesný čas startu
  };
}

export const NotificationService = {
  async isAvailable() {
    return Capacitor.isNativePlatform();
  },

  async requestPermissions() {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const request = await LocalNotifications.requestPermissions();
        return request.display === 'granted';
      }
      return true;
    } catch (e) {
      console.warn('[NotificationService] Chyba při vyžádání oprávnění:', e);
      return false;
    }
  },

  async scheduleForArtist(item, stageName, showToast = true) {
    if (!Capacitor.isNativePlatform()) return;
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    const { id15m, idStart } = getNotificationIds(item.itemId);
    const nowMs = Date.now();

    // Přímé milisekundy z UTC timestampu
    const timeStartMs = item.sTS * 1000;
    const time15mMs = (item.sTS - 15 * 60) * 1000;

    const notificationsToSchedule = [];

    // 15 minut předem
    if (time15mMs > nowMs) {
      notificationsToSchedule.push({
        id: id15m,
        title: `Za 15 min začíná ${item.name}`,
        body: `${item.name} vystoupí na ${stageName}.`,
        schedule: { at: new Date(time15mMs) },
        sound: 'res://platform_default',
        extra: { itemId: item.itemId }
      });
    }

    // Přesný start
    if (timeStartMs > nowMs) {
      notificationsToSchedule.push({
        id: idStart,
        title: `${item.name} právě začíná!`,
        body: `Začíná set na stagi ${stageName}.`,
        schedule: { at: new Date(timeStartMs) },
        sound: 'res://platform_default',
        extra: { itemId: item.itemId }
      });
    }

    if (notificationsToSchedule.length > 0) {
      try {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        console.log(`[NotificationService] Naplánováno pro: ${item.name}`);

        if (showToast) {
          await Toast.show({
            text: `Notifikace nastavena: ${item.name}`,
            duration: 'short'
          });
        }
      } catch (e) {
        console.error('[NotificationService] Chyba při plánování:', e);
      }
    } else if (showToast) {
      await Toast.show({
        text: `Vystoupení ${item.name} již proběhlo`,
        duration: 'short'
      });
    }
  },

  async cancelForArtist(itemId, artistName = '', showToast = true) {
    if (!Capacitor.isNativePlatform()) return;
    const { id15m, idStart } = getNotificationIds(itemId);
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: id15m }, { id: idStart }]
      });
      console.log(`[NotificationService] Zrušeno pro ID: ${itemId}`);

      if (showToast) {
        const text = artistName ? `Notifikace odebrána: ${artistName}` : 'Notifikace odebrána';
        await Toast.show({
          text,
          duration: 'short'
        });
      }
    } catch (e) {
      console.error('[NotificationService] Chyba při rušení:', e);
    }
  },

  async syncNotifications(allData, favorites, toTSFn) {
    if (!Capacitor.isNativePlatform()) return;
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    try {
      const pendingResult = await LocalNotifications.getPending();
      const pendingIds = new Set(pendingResult.notifications.map(n => n.id));
      const nowMs = Date.now();

      for (const item of allData) {
        const itemId = btoa(encodeURIComponent(item.name + '_' + item.time_start)).replace(/=/g, '');
        const sTS = toTSFn(item.date_start, item.time_start);
        const isFav = favorites.includes(itemId);
        const { id15m, idStart } = getNotificationIds(itemId);

        const itemWithMeta = { ...item, itemId, sTS };

        if (isFav) {
          const timeStartMs = sTS * 1000;
          const time15mMs = (sTS - 15 * 60) * 1000;

          const needs15m = time15mMs > nowMs && !pendingIds.has(id15m);
          const needsStart = timeStartMs > nowMs && !pendingIds.has(idStart);

          if (needs15m || needsStart) {
            console.log(`[NotificationService Sync] Doplánovávám notifikaci pro: ${item.name}`);
            await this.scheduleForArtist(itemWithMeta, item.tab, false);
          }
        } else {
          if (pendingIds.has(id15m) || pendingIds.has(idStart)) {
            console.log(`[NotificationService Sync] Ruším neplatnou notifikaci pro: ${item.name}`);
            await this.cancelForArtist(itemId, item.name, false);
          }
        }
      }
    } catch (e) {
      console.error('[NotificationService] Chyba při synchronizaci:', e);
    }
  }
};