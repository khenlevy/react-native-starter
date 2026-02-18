import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import colors from '../theme/colors';
import { typography } from '../theme/typography';
import BottomBar from '../components/BottomBar/BottomBar';
import { SearchResult } from '../ajax/search/search';

type RouteParams = {
  item: SearchResult;
};

const ResultView = () => {
  const route = useRoute();
  const { item } = route.params as RouteParams;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.description}>{item.desc}</Text>
        <Text style={styles.type}>Type: {item.type === 'gift_card' ? 'Gift Card' : 'Coupon'}</Text>
      </View>
      <BottomBar />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    padding: 16,
    marginBottom: Platform.select({ ios: 85, android: 60 }),
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: 8,
  },
  description: {
    ...typography.body1,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  type: {
    ...typography.body2,
    color: colors.text.secondary,
  },
});

export default ResultView; 