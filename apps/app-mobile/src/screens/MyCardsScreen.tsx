import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';
import colors from '../theme/colors';
import { typography } from '../theme/typography';
import BottomBar from '../components/BottomBar/BottomBar';

const MyCardsScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>My Cards</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.select({ ios: 85, android: 60 }),
  },
  text: {
    ...typography.h1,
    color: colors.text.primary,
  },
});

export default MyCardsScreen; 