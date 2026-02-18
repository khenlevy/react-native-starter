// src/components/OnboardingLayout.tsx
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';

type Props = {
  children: React.ReactNode;
};

const { width, height } = Dimensions.get('window');
const HORIZONTAL_MARGIN = 16;

export default function OnboardingLayout({ children }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.secondary, // previously colors.white
  },
  card: {
    flex: 1,
    marginHorizontal: HORIZONTAL_MARGIN,
    marginVertical: 8,
    backgroundColor: colors.brand.primary, // previously colors.primary
    borderRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
