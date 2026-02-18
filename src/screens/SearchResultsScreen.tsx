import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import colors from '../theme/colors';
import { typography } from '../theme/typography';
import BottomBar from '../components/BottomBar/BottomBar';
import { SearchResult } from '../ajax/search/search';

type RouteParams = {
  business: SearchResult;
};

const SearchResultsScreen = () => {
  const route = useRoute();
  const { business } = route.params as RouteParams;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{business.name}</Text>
        <Text style={styles.description}>{business.desc}</Text>
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
  },
});

export default SearchResultsScreen; 