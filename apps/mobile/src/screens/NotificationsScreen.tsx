import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { api } from '../api';
import type { AppNotification } from '../api/types';
import { useUnread } from '../auth/UnreadContext';
import { Button, Card, EmptyState, ErrorBanner, ErrorState, Loading, Screen, Text } from '../components';
import { errorMessage } from '../hooks/useResource';
import { usePaged } from '../hooks/usePaged';
import { formatDateTime } from '../lib/dates';
import { colors, spacing } from '../theme';

export default function NotificationsScreen() {
  const { unread, refreshUnread } = useUnread();
  const list = usePaged<AppNotification>((p) => api.notifications.list(p), 'n');
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [localRead, setLocalRead] = useState<Record<string, string>>({});

  const isUnread = (n: AppNotification) => n.readAt === null && !localRead[n.id];

  const markRead = async (n: AppNotification) => {
    if (!isUnread(n)) return;
    setError(null);
    setLocalRead((m) => ({ ...m, [n.id]: new Date().toISOString() }));
    try { await api.notifications.markRead(n.id); } catch (e) {
      setLocalRead((m) => { const { [n.id]: _drop, ...rest } = m; return rest; });
      setError(errorMessage(e));
    }
    void refreshUnread();
  };

  const markAll = async () => {
    setMarking(true); setError(null);
    try {
      await api.notifications.markAllRead();
      setLocalRead(Object.fromEntries(list.items.map((n) => [n.id, new Date().toISOString()])));
      await list.onRefresh();
    } catch (e) { setError(errorMessage(e)); } finally { setMarking(false); await refreshUnread(); }
  };

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text variant="title">Notifications</Text>
        <Button label="Mark all read" variant="ghost" onPress={() => void markAll()} loading={marking} disabled={unread === 0} style={styles.markAll} />
      </View>
      <View style={styles.pad}><ErrorBanner message={error} /></View>
      {list.loading && list.items.length === 0 ? <Loading /> : list.error && list.items.length === 0 ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshing={list.refreshing}
          onRefresh={async () => { await list.onRefresh(); await refreshUnread(); }}
          onEndReached={() => void list.loadMore()}
          onEndReachedThreshold={0.4}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="You are all caught up" message="Approvals and card alerts show up here." />}
          ListFooterComponent={<>{list.loadingMore ? <ActivityIndicator style={styles.footer} color={colors.accent} /> : null}</>}
          renderItem={({ item }) => {
            const un = isUnread(item);
            return (
              <Card onPress={() => void markRead(item)} style={un ? styles.unread : undefined} accessibilityLabel={`${un ? 'Unread. ' : ''}${item.title}`}>
                <View style={styles.titleRow}>
                  {un ? <View style={styles.dot} /> : null}
                  <Text weight={un ? '700' : '500'} style={styles.flex}>{item.title}</Text>
                  {un ? <Text variant="caption" color={colors.accent} weight="700">NEW</Text> : null}
                </View>
                <Text variant="small" muted style={styles.body}>{item.body}</Text>
                <Text variant="caption" muted style={styles.body}>{formatDateTime(item.createdAt)}</Text>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: spacing.xs },
  markAll: { minHeight: 40 },
  pad: { paddingHorizontal: spacing.md },
  list: { padding: spacing.md, flexGrow: 1 },
  unread: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  body: { marginTop: spacing.xxs },
  footer: { padding: spacing.md },
});
