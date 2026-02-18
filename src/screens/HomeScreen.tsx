import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { startLocationTracking } from '../services/tracking/tracker';
import colors from '../theme/colors';

const HomeScreen = ({ navigation }: any) => {
  useEffect(() => {
    startLocationTracking();
  }, []);

  return (
    <View style={styles.container}>
      <Text>Welcome to Home</Text>
      <Button title="Go to Settings" onPress={() => navigation.navigate('Settings')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
