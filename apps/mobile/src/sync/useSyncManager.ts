import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";
import { failedCount, pendingCount } from "../db/outbox";
import { flushOutbox } from "./syncManager";

export function useSyncManager() {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(() => {
    setPending(pendingCount());
    setFailed(failedCount());
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await flushOutbox();
    } finally {
      refreshPendingCount();
      setSyncing(false);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      if (online) {
        syncNow();
      }
    });
    // Also retry periodically in case connectivity events are missed.
    const interval = setInterval(() => {
      if (isOnline) syncNow();
    }, 30_000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, pending, failed, syncing, syncNow, refreshPendingCount };
}
